import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { hashRefreshToken } from './refresh-token.util';

type Row = Record<string, unknown>;

function fakePrisma() {
  const users = new Map<string, Row>();
  const tokens = new Map<string, Row>();
  let seq = 0;
  const prisma = {
    _users: users,
    _tokens: tokens,
    user: {
      findUnique: async ({ where }: { where: { id?: string; email?: string } }) =>
        [...users.values()].find(
          (u) => u.id === where.id || u.email === where.email,
        ) ?? null,
      create: async ({ data }: { data: Row }) => {
        const u = { id: `u${++seq}`, ...data };
        users.set(u.id, u);
        return u;
      },
    },
    refreshToken: {
      create: async ({ data }: { data: Row }) => {
        const t = { id: `t${++seq}`, revokedAt: null, ...data };
        tokens.set(t.id, t);
        return t;
      },
      findUnique: async ({
        where,
        include,
      }: {
        where: { tokenHash: string };
        include?: { user?: boolean };
      }) => {
        const t = [...tokens.values()].find((x) => x.tokenHash === where.tokenHash) ?? null;
        if (t && include?.user) return { ...t, user: users.get(t.userId as string) };
        return t;
      },
      update: async ({ where, data }: { where: { id: string }; data: Row }) => {
        const t = { ...tokens.get(where.id), ...data };
        tokens.set(where.id, t);
        return t;
      },
      updateMany: async ({
        where,
        data,
      }: {
        where: { tokenHash: string };
        data: Row;
      }) => {
        let count = 0;
        for (const t of tokens.values()) {
          if (t.tokenHash === where.tokenHash && t.revokedAt == null) {
            Object.assign(t, data);
            count++;
          }
        }
        return { count };
      },
    },
  };
  return prisma as unknown as PrismaService & { _tokens: Map<string, Row> };
}

function service(prisma: PrismaService) {
  const jwt = { sign: () => 'signed.jwt.token' } as unknown as JwtService;
  const config = {
    get: (_k: string, def?: string) => def,
  } as unknown as ConfigService;
  return new AuthService(prisma, jwt, config);
}

describe('AuthService — refresh tokens', () => {
  it('register/login emiten access + refresh token', async () => {
    const prisma = fakePrisma();
    const svc = service(prisma);
    const res = await svc.register({ email: 'a@b.com', password: 'secret123' });
    expect(res.token).toBe('signed.jwt.token');
    expect(res.refreshToken).toEqual(expect.any(String));
    expect(res.refreshToken.length).toBeGreaterThan(20);
  });

  it('refresh rota el token: emite uno nuevo y revoca el usado', async () => {
    const prisma = fakePrisma();
    const svc = service(prisma);
    const { refreshToken } = await svc.register({ email: 'a@b.com', password: 'secret123' });

    const rotated = await svc.refresh(refreshToken);
    expect(rotated.refreshToken).not.toBe(refreshToken);

    await expect(svc.refresh(refreshToken)).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(svc.refresh(rotated.refreshToken)).resolves.toHaveProperty('refreshToken');
  });

  it('logout revoca el refresh token (idempotente)', async () => {
    const prisma = fakePrisma();
    const svc = service(prisma);
    const { refreshToken } = await svc.register({ email: 'a@b.com', password: 'secret123' });

    await expect(svc.logout(refreshToken)).resolves.toEqual({ ok: true });
    await expect(svc.refresh(refreshToken)).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(svc.logout(refreshToken)).resolves.toEqual({ ok: true });
  });

  it('rechaza un refresh token vencido', async () => {
    const prisma = fakePrisma();
    const svc = service(prisma);
    const { refreshToken } = await svc.register({ email: 'a@b.com', password: 'secret123' });
    for (const t of prisma._tokens.values()) {
      if (t.tokenHash === hashRefreshToken(refreshToken)) {
        t.expiresAt = new Date(Date.now() - 1000);
      }
    }
    await expect(svc.refresh(refreshToken)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rechaza un refresh token inexistente', async () => {
    const svc = service(fakePrisma());
    await expect(svc.refresh('no-existe')).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
