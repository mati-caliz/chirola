import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards, UsePipes } from "@nestjs/common";
import {
  AuthResponse,
  loginSchema,
  refreshSchema,
  registerSchema,
  type LoginInput,
  type RefreshInput,
  type RegisterInput,
} from "@chirola/shared";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { AuthService } from "./auth.service";
import { CredentialsRateLimitGuard, RefreshRateLimitGuard } from "./auth-rate-limit.guards";

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("register")
  @UseGuards(CredentialsRateLimitGuard)
  @UsePipes(new ZodValidationPipe(registerSchema))
  register(@Body() body: RegisterInput): Promise<AuthResponse> {
    return this.auth.register(body);
  }

  @Post("login")
  @UseGuards(CredentialsRateLimitGuard)
  @UsePipes(new ZodValidationPipe(loginSchema))
  login(@Body() body: LoginInput): Promise<AuthResponse> {
    return this.auth.login(body);
  }

  @Post("refresh")
  @UseGuards(RefreshRateLimitGuard)
  @UsePipes(new ZodValidationPipe(refreshSchema))
  refresh(@Body() body: RefreshInput): Promise<AuthResponse> {
    return this.auth.refresh(body.refreshToken);
  }

  @Post("logout")
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ZodValidationPipe(refreshSchema))
  logout(@Body() body: RefreshInput): Promise<{ ok: true }> {
    return this.auth.logout(body.refreshToken);
  }
}
