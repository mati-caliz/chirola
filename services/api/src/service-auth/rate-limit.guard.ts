import {
  CanActivate,
  ExecutionContext,
  Injectable,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { RequestWithApiClient } from './service-auth.guard';

const DEFAULT_MAX_REQUESTS = 120;
const DEFAULT_WINDOW_MS = 60_000;

interface Window {
  count: number;
  resetAt: number;
}

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly windows = new Map<string, Window>();
  private readonly maxRequests: number;
  private readonly windowMs: number;

  constructor(config: ConfigService) {
    this.maxRequests = config.get<number>(
      'SERVICE_RATE_LIMIT_MAX',
      DEFAULT_MAX_REQUESTS,
    );
    this.windowMs = config.get<number>(
      'SERVICE_RATE_LIMIT_WINDOW_MS',
      DEFAULT_WINDOW_MS,
    );
  }

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<RequestWithApiClient>();
    const apiClientId = req.apiClient?.id;
    if (!apiClientId) {
      return true;
    }

    const now = Date.now();
    const window = this.windows.get(apiClientId);
    if (!window || now >= window.resetAt) {
      this.windows.set(apiClientId, { count: 1, resetAt: now + this.windowMs });
      return true;
    }

    if (window.count >= this.maxRequests) {
      const retryAfterSeconds = Math.ceil((window.resetAt - now) / 1000);
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Límite de solicitudes excedido.',
          retryAfterSeconds,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    window.count += 1;
    return true;
  }
}
