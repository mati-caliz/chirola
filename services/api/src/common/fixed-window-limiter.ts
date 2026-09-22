import { HttpException, HttpStatus } from '@nestjs/common';

const MS_PER_SECOND = 1000;
const MAX_TRACKED_KEYS = 10_000;

interface Window {
  count: number;
  resetAt: number;
}

export class FixedWindowLimiter {
  private readonly windows = new Map<string, Window>();

  constructor(
    private readonly maxRequests: number,
    private readonly windowMs: number,
  ) {}

  consume(key: string): void {
    const now = Date.now();
    const window = this.windows.get(key);
    if (!window || now >= window.resetAt) {
      this.pruneExpiredWhenFull(now);
      this.windows.set(key, { count: 1, resetAt: now + this.windowMs });
      return;
    }
    if (window.count >= this.maxRequests) {
      throw tooManyRequests(Math.ceil((window.resetAt - now) / MS_PER_SECOND));
    }
    window.count += 1;
  }

  private pruneExpiredWhenFull(now: number): void {
    if (this.windows.size < MAX_TRACKED_KEYS) {
      return;
    }
    for (const [key, window] of this.windows) {
      if (now >= window.resetAt) {
        this.windows.delete(key);
      }
    }
  }
}

function tooManyRequests(retryAfterSeconds: number): HttpException {
  return new HttpException(
    {
      statusCode: HttpStatus.TOO_MANY_REQUESTS,
      message: 'Límite de solicitudes excedido.',
      retryAfterSeconds,
    },
    HttpStatus.TOO_MANY_REQUESTS,
  );
}
