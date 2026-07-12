import {
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { AuthResponse, LoginInput, RegisterInput } from '@chirola/shared';
import { PrismaService } from '../prisma/prisma.service';
import { hashPassword, verifyPassword } from './password.util';

/** Hash señuelo para igualar el timing cuando el email no existe. */
const DUMMY_HASH = hashPassword('dummy-para-timing');

export interface JwtPayload {
  sub: string;
  email: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

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
    return this.buildResponse(user.id, user.email);
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
    return this.buildResponse(user.id, user.email);
  }

  private buildResponse(id: string, email: string): AuthResponse {
    const payload: JwtPayload = { sub: id, email };
    return { token: this.jwt.sign(payload), user: { id, email } };
  }
}
