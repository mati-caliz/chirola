import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Request } from "express";
import { FixedWindowLimiter } from "../common/fixed-window-limiter";

const FIFTEEN_MINUTES_MS = 15 * 60_000;
const DEFAULT_CREDENTIAL_ATTEMPTS = 10;
const DEFAULT_REFRESH_ATTEMPTS = 60;
const UNKNOWN_CLIENT = "unknown";

function requestOf(context: ExecutionContext): Request {
  return context.switchToHttp().getRequest<Request>();
}

function normalizedEmail(body: unknown): string | null {
  if (body === null || typeof body !== "object" || !("email" in body)) {
    return null;
  }
  const { email } = body;
  return typeof email === "string" ? email.trim().toLowerCase() : null;
}

@Injectable()
export class CredentialsRateLimitGuard implements CanActivate {
  private readonly limiter: FixedWindowLimiter;

  constructor(config: ConfigService) {
    this.limiter = new FixedWindowLimiter(
      config.get<number>("AUTH_CREDENTIAL_ATTEMPTS", DEFAULT_CREDENTIAL_ATTEMPTS),
      config.get<number>("AUTH_RATE_LIMIT_WINDOW_MS", FIFTEEN_MINUTES_MS),
    );
  }

  canActivate(context: ExecutionContext): boolean {
    const req = requestOf(context);
    const email = normalizedEmail(req.body);
    this.limiter.consume(email === null ? `ip:${req.ip ?? UNKNOWN_CLIENT}` : `email:${email}`);
    return true;
  }
}

@Injectable()
export class RefreshRateLimitGuard implements CanActivate {
  private readonly limiter: FixedWindowLimiter;

  constructor(config: ConfigService) {
    this.limiter = new FixedWindowLimiter(
      config.get<number>("AUTH_REFRESH_ATTEMPTS", DEFAULT_REFRESH_ATTEMPTS),
      config.get<number>("AUTH_RATE_LIMIT_WINDOW_MS", FIFTEEN_MINUTES_MS),
    );
  }

  canActivate(context: ExecutionContext): boolean {
    this.limiter.consume(`ip:${requestOf(context).ip ?? UNKNOWN_CLIENT}`);
    return true;
  }
}
