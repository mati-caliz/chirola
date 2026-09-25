import { UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { AuthService } from "./auth.service";
import { PrismaService } from "../prisma/prisma.service";
import { instantiateWithDoubles } from "../common/testing/instantiate-with-doubles";
import { hashRefreshToken } from "./refresh-token.util";

interface UserRow {
  id: string;
  email: string;
  password: string;
}

interface TokenRow {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
}

interface TokenUpdate {
  revokedAt?: Date | null;
  expiresAt?: Date;
}

const ONE_SECOND_MS = 1000;
const MINIMUM_REFRESH_TOKEN_LENGTH = 20;

function fakePrisma() {
  const users = new Map<string, UserRow>();
  const tokens = new Map<string, TokenRow>();
  let sequence = 0;
  return {
    tokens,
    user: {
      findUnique: ({ where }: { where: { id?: string; email?: string } }) =>
        Promise.resolve(
          [...users.values()].find((row) => row.id === where.id || row.email === where.email) ?? null,
        ),
      create: ({ data }: { data: Omit<UserRow, "id"> }) => {
        const user = { id: `u${String(++sequence)}`, ...data };
        users.set(user.id, user);
        return Promise.resolve(user);
      },
    },
    refreshToken: {
      create: ({ data }: { data: Omit<TokenRow, "id" | "revokedAt"> }) => {
        const item: TokenRow = { id: `t${String(++sequence)}`, revokedAt: null, ...data };
        tokens.set(item.id, item);
        return Promise.resolve(item);
      },
      findUnique: ({ where, include }: { where: { tokenHash: string }; include?: { user?: boolean } }) => {
        const item = [...tokens.values()].find((row) => row.tokenHash === where.tokenHash) ?? null;
        if (item !== null && include?.user === true) {
          return Promise.resolve({ ...item, user: users.get(item.userId) });
        }
        return Promise.resolve(item);
      },
      update: ({ where, data }: { where: { id: string }; data: TokenUpdate }) => {
        const existing = tokens.get(where.id);
        if (existing !== undefined) Object.assign(existing, data);
        return Promise.resolve(existing);
      },
      updateMany: ({ where, data }: { where: { tokenHash: string }; data: TokenUpdate }) => {
        let count = 0;
        for (const row of tokens.values()) {
          if (row.tokenHash === where.tokenHash && row.revokedAt === null) {
            Object.assign(row, data);
            count++;
          }
        }
        return Promise.resolve({ count });
      },
    },
  };
}

type FakePrisma = ReturnType<typeof fakePrisma>;

function service(prisma: FakePrisma): Promise<AuthService> {
  const jwt = { sign: () => "signed.jwt.token" };
  const config = { get: (_key: string, defaultValue?: string) => defaultValue };
  return instantiateWithDoubles(AuthService, [
    { token: PrismaService, value: prisma },
    { token: JwtService, value: jwt },
    { token: ConfigService, value: config },
  ]);
}

describe("AuthService — refresh tokens", () => {
  it("register/login emiten access + refresh token", async () => {
    const prisma = fakePrisma();
    const authService = await service(prisma);
    const response = await authService.register({ email: "a@b.com", password: "secret123" });
    expect(response.token).toBe("signed.jwt.token");
    expect(response.refreshToken).toEqual(expect.any(String));
    expect(response.refreshToken.length).toBeGreaterThan(MINIMUM_REFRESH_TOKEN_LENGTH);
  });

  it("refresh rota el token: emite uno nuevo y revoca el usado", async () => {
    const prisma = fakePrisma();
    const authService = await service(prisma);
    const { refreshToken } = await authService.register({ email: "a@b.com", password: "secret123" });

    const rotated = await authService.refresh(refreshToken);
    expect(rotated.refreshToken).not.toBe(refreshToken);

    await expect(authService.refresh(refreshToken)).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(authService.refresh(rotated.refreshToken)).resolves.toHaveProperty("refreshToken");
  });

  it("logout revoca el refresh token (idempotente)", async () => {
    const prisma = fakePrisma();
    const authService = await service(prisma);
    const { refreshToken } = await authService.register({ email: "a@b.com", password: "secret123" });

    await expect(authService.logout(refreshToken)).resolves.toEqual({ ok: true });
    await expect(authService.refresh(refreshToken)).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(authService.logout(refreshToken)).resolves.toEqual({ ok: true });
  });

  it("rechaza un refresh token vencido", async () => {
    const prisma = fakePrisma();
    const authService = await service(prisma);
    const { refreshToken } = await authService.register({ email: "a@b.com", password: "secret123" });
    for (const row of prisma.tokens.values()) {
      if (row.tokenHash === hashRefreshToken(refreshToken)) {
        row.expiresAt = new Date(Date.now() - ONE_SECOND_MS);
      }
    }
    await expect(authService.refresh(refreshToken)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("rechaza un refresh token inexistente", async () => {
    const authService = await service(fakePrisma());
    await expect(authService.refresh("no-existe")).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
