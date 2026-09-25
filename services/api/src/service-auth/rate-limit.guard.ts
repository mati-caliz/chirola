import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { FixedWindowLimiter } from "../common/fixed-window-limiter";
import { hasText } from "@chirola/shared";
import type { RequestMaybeWithApiClient } from "./service-auth.guard";

const DEFAULT_MAX_REQUESTS = 120;
const DEFAULT_WINDOW_MS = 60_000;

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly limiter: FixedWindowLimiter;

  constructor(config: ConfigService) {
    this.limiter = new FixedWindowLimiter(
      config.get<number>("SERVICE_RATE_LIMIT_MAX", DEFAULT_MAX_REQUESTS),
      config.get<number>("SERVICE_RATE_LIMIT_WINDOW_MS", DEFAULT_WINDOW_MS),
    );
  }

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<RequestMaybeWithApiClient>();
    const apiClientId = req.apiClient?.id;
    if (hasText(apiClientId)) {
      this.limiter.consume(apiClientId);
    }
    return true;
  }
}
