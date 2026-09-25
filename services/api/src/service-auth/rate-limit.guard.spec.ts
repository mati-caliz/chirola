import { HttpException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ExecutionContextHost } from "@nestjs/core/helpers/execution-context-host";
import { hasText } from "@chirola/shared";
import { RateLimitGuard } from "./rate-limit.guard";
import { instantiateWithDoubles } from "../common/testing/instantiate-with-doubles";

const ONE_MINUTE_MS = 60_000;
const SHORT_WINDOW_MS = 10;
const PAST_SHORT_WINDOW_MS = 20;
const MAX_REQUESTS = 3;

function createGuard(max: number, windowMs: number): Promise<RateLimitGuard> {
  const settings = new Map<string, number>([
    ["SERVICE_RATE_LIMIT_MAX", max],
    ["SERVICE_RATE_LIMIT_WINDOW_MS", windowMs],
  ]);
  const config = { get: (key: string, defaultValue?: number) => settings.get(key) ?? defaultValue };
  return instantiateWithDoubles(RateLimitGuard, [{ token: ConfigService, value: config }]);
}

function contextFor(apiClientId?: string): ExecutionContextHost {
  const request = { apiClient: hasText(apiClientId) ? { id: apiClientId } : undefined };
  return new ExecutionContextHost([request]);
}

describe("RateLimitGuard", () => {
  it("permite hasta el máximo y luego bloquea con 429", async () => {
    const guard = await createGuard(MAX_REQUESTS, ONE_MINUTE_MS);
    const context = contextFor("client-1");

    expect(guard.canActivate(context)).toBe(true);
    expect(guard.canActivate(context)).toBe(true);
    expect(guard.canActivate(context)).toBe(true);
    expect(() => guard.canActivate(context)).toThrow(HttpException);
  });

  it("aísla el conteo por ApiClient", async () => {
    const guard = await createGuard(1, ONE_MINUTE_MS);
    expect(guard.canActivate(contextFor("client-1"))).toBe(true);
    expect(guard.canActivate(contextFor("client-2"))).toBe(true);
    expect(() => guard.canActivate(contextFor("client-1"))).toThrow(HttpException);
  });

  it("reinicia el conteo al vencer la ventana", async () => {
    const guard = await createGuard(1, SHORT_WINDOW_MS);
    const context = contextFor("client-1");
    expect(guard.canActivate(context)).toBe(true);
    expect(() => guard.canActivate(context)).toThrow(HttpException);
    const later = Date.now() + PAST_SHORT_WINDOW_MS;
    jest.spyOn(Date, "now").mockReturnValue(later);
    expect(guard.canActivate(context)).toBe(true);
    jest.restoreAllMocks();
  });

  it("no limita si no hay ApiClient en el request", async () => {
    const guard = await createGuard(0, ONE_MINUTE_MS);
    expect(guard.canActivate(contextFor())).toBe(true);
  });
});
