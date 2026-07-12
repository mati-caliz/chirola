import { ExecutionContext, HttpException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RateLimitGuard } from './rate-limit.guard';

function config(max: number, windowMs: number): ConfigService {
  return {
    get: (key: string, def?: number) =>
      key === 'SERVICE_RATE_LIMIT_MAX'
        ? max
        : key === 'SERVICE_RATE_LIMIT_WINDOW_MS'
          ? windowMs
          : def,
  } as unknown as ConfigService;
}

function contextFor(apiClientId?: string): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ apiClient: apiClientId ? { id: apiClientId } : undefined }),
    }),
  } as unknown as ExecutionContext;
}

describe('RateLimitGuard', () => {
  it('permite hasta el máximo y luego bloquea con 429', () => {
    const guard = new RateLimitGuard(config(3, 60_000));
    const ctx = contextFor('client-1');

    expect(guard.canActivate(ctx)).toBe(true);
    expect(guard.canActivate(ctx)).toBe(true);
    expect(guard.canActivate(ctx)).toBe(true);
    expect(() => guard.canActivate(ctx)).toThrow(HttpException);
  });

  it('aísla el conteo por ApiClient', () => {
    const guard = new RateLimitGuard(config(1, 60_000));
    expect(guard.canActivate(contextFor('client-1'))).toBe(true);
    expect(guard.canActivate(contextFor('client-2'))).toBe(true);
    expect(() => guard.canActivate(contextFor('client-1'))).toThrow(HttpException);
  });

  it('reinicia el conteo al vencer la ventana', () => {
    const guard = new RateLimitGuard(config(1, 10));
    const ctx = contextFor('client-1');
    expect(guard.canActivate(ctx)).toBe(true);
    expect(() => guard.canActivate(ctx)).toThrow(HttpException);
    const later = Date.now() + 20;
    jest.spyOn(Date, 'now').mockReturnValue(later);
    expect(guard.canActivate(ctx)).toBe(true);
    jest.restoreAllMocks();
  });

  it('no limita si no hay ApiClient en el request', () => {
    const guard = new RateLimitGuard(config(0, 60_000));
    expect(guard.canActivate(contextFor(undefined))).toBe(true);
  });
});
