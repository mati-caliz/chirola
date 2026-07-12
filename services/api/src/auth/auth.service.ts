import {
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { AuthResponse, LoginInput, RegisterInput } from '@chirola/shared';
import { PrismaService } from '../prisma/prisma.service';
import { hashPassword, verifyPassword } from './password.util';
import { generarRefreshToken, hashRefreshToken } from './refresh-token.util';

/** Hash señuelo para igualar el timing cuando el email no existe. */
const DUMMY_HASH = hashPassword('dummy-para-timing');

export interface JwtPayload {
  sub: string;
  email: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  /** Vida del refresh token en días (configurable). */
  private readonly refreshTtlDays: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    config: ConfigService,
  ) {
    this.refreshTtlDays = Number(config.get('REFRESH_TOKEN_TTL_DAYS', '30'));
  }

  async register(input: RegisterInput): Promise<AuthResponse> {
    const existing = await this.prisma.user.findUnique({
      where: { email: input.email },
    });
    if (existing) {
      throw new ConflictException('Ya existe un usuario con ese email.');
    }
    const user = await this.prisma.user.create({
      data: { email: input.email, password: hashPassword(input.password) },
    });
    this.logger.log(`Usuario registrado: ${user.id}`);
    return this.emitirTokens(user.id, user.email);
  }

  async login(input: LoginInput): Promise<AuthResponse> {
    const user = await this.prisma.user.findUnique({
      where: { email: input.email },
    });
    if (!user) {
      // Comparación señuelo para no filtrar si el email existe (timing).
      verifyPassword(input.password, DUMMY_HASH);
      throw new UnauthorizedException('Credenciales inválidas.');
    }
    if (!verifyPassword(input.password, user.password)) {
      throw new UnauthorizedException('Credenciales inválidas.');
    }
    return this.emitirTokens(user.id, user.email);
  }

  /**
   * Canjea un refresh token válido por un par nuevo (rotación): revoca el token
   * usado y emite uno nuevo. Si el token no existe, está revocado o vencido → 401.
   */
  async refresh(rawToken: string): Promise<AuthResponse> {
    const tokenHash = hashRefreshToken(rawToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token inválido o expirado.');
    }
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });
    return this.emitirTokens(stored.user.id, stored.user.email);
  }

  /** Revoca un refresh token (logout). Idempotente: siempre responde ok. */
  async logout(rawToken: string): Promise<{ ok: true }> {
    const tokenHash = hashRefreshToken(rawToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { ok: true };
  }

  /** Emite un access token (JWT) + un refresh token opaco persistido (hasheado). */
  private async emitirTokens(id: string, email: string): Promise<AuthResponse> {
    const payload: JwtPayload = { sub: id, email };
    const refreshToken = generarRefreshToken();
    const expiresAt = new Date(
      Date.now() + this.refreshTtlDays * 24 * 60 * 60 * 1000,
    );
    await this.prisma.refreshToken.create({
      data: { userId: id, tokenHash: hashRefreshToken(refreshToken), expiresAt },
    });
    return { token: this.jwt.sign(payload), refreshToken, user: { id, email } };
  }
}
