import { HttpException, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ExecutionContextHost } from "@nestjs/core/helpers/execution-context-host";
import { JwtService } from "@nestjs/jwt";
import { CredentialsRateLimitGuard, RefreshRateLimitGuard } from "./auth-rate-limit.guards";
import { JwtAuthGuard } from "./jwt-auth.guard";

const JWT_SECRET = "test-secret";
const OTHER_JWT_SECRET = "other-secret";
const CREDENTIAL_ATTEMPTS = 2;
const REFRESH_ATTEMPTS = 1;
const WINDOW_MS = 60_000;

interface FakeRequest {
  ip?: string;
  body?: unknown;
  headers: { authorization?: string };
  user?: unknown;
}

function contextFor(request: FakeRequest): ExecutionContextHost {
  return new ExecutionContextHost([request]);
}

function rateLimitConfig(): ConfigService {
  return new ConfigService({
    AUTH_CREDENTIAL_ATTEMPTS: CREDENTIAL_ATTEMPTS,
    AUTH_REFRESH_ATTEMPTS: REFRESH_ATTEMPTS,
    AUTH_RATE_LIMIT_WINDOW_MS: WINDOW_MS,
  });
}

function loginRequest(body: unknown, ip = "first-client"): FakeRequest {
  return { ip, body, headers: {} };
}

function exhaust(guard: CredentialsRateLimitGuard, request: FakeRequest): void {
  for (let attempt = 0; attempt < CREDENTIAL_ATTEMPTS; attempt += 1) {
    expect(guard.canActivate(contextFor(request))).toBe(true);
  }
}

describe("CredentialsRateLimitGuard", () => {
  it("blocks further attempts for the same email once the limit is reached", () => {
    const guard = new CredentialsRateLimitGuard(rateLimitConfig());
    exhaust(guard, loginRequest({ email: "ana@example.com" }));

    expect(() => guard.canActivate(contextFor(loginRequest({ email: "ana@example.com" })))).toThrow(
      HttpException,
    );
  });

  it("normalizes the email so case and surrounding spaces share the same counter", () => {
    const guard = new CredentialsRateLimitGuard(rateLimitConfig());
    exhaust(guard, loginRequest({ email: "Ana@Example.com" }));

    expect(() =>
      guard.canActivate(contextFor(loginRequest({ email: "  ana@example.COM " }, "second-client"))),
    ).toThrow(HttpException);
  });

  it("keeps separate counters per email even from the same client address", () => {
    const guard = new CredentialsRateLimitGuard(rateLimitConfig());
    exhaust(guard, loginRequest({ email: "ana@example.com" }));

    expect(guard.canActivate(contextFor(loginRequest({ email: "beto@example.com" })))).toBe(true);
  });

  it.each([
    ["a missing body", undefined],
    ["a null body", null],
    ["a body without email", { password: "secret" }],
    ["a non-string email", { email: 42 }],
  ])("falls back to the client address for %s", (_description, body) => {
    const guard = new CredentialsRateLimitGuard(rateLimitConfig());
    exhaust(guard, loginRequest(body, "shared-client"));

    expect(() => guard.canActivate(contextFor(loginRequest(body, "shared-client")))).toThrow(HttpException);
    expect(guard.canActivate(contextFor(loginRequest(body, "other-client")))).toBe(true);
  });

  it("groups requests without address nor email under a single unknown client", () => {
    const guard = new CredentialsRateLimitGuard(rateLimitConfig());
    const anonymous: FakeRequest = { headers: {} };
    exhaust(guard, anonymous);

    expect(() => guard.canActivate(contextFor({ headers: {} }))).toThrow(HttpException);
  });

  it("uses the default of ten attempts when nothing is configured", () => {
    const defaultAttempts = 10;
    const guard = new CredentialsRateLimitGuard(new ConfigService({}));
    const request = loginRequest({ email: "ana@example.com" });
    for (let attempt = 0; attempt < defaultAttempts; attempt += 1) {
      guard.canActivate(contextFor(request));
    }

    expect(() => guard.canActivate(contextFor(request))).toThrow(HttpException);
  });
});

describe("RefreshRateLimitGuard", () => {
  it("limits refresh attempts per client address", () => {
    const guard = new RefreshRateLimitGuard(rateLimitConfig());

    expect(guard.canActivate(contextFor({ ip: "first-client", headers: {} }))).toBe(true);
    expect(() => guard.canActivate(contextFor({ ip: "first-client", headers: {} }))).toThrow(HttpException);
    expect(guard.canActivate(contextFor({ ip: "second-client", headers: {} }))).toBe(true);
  });

  it("groups requests without address under a single unknown client", () => {
    const guard = new RefreshRateLimitGuard(rateLimitConfig());

    expect(guard.canActivate(contextFor({ headers: {} }))).toBe(true);
    expect(() => guard.canActivate(contextFor({ headers: {} }))).toThrow(HttpException);
  });
});

describe("JwtAuthGuard", () => {
  const jwt = new JwtService({ secret: JWT_SECRET });
  const guard = new JwtAuthGuard(jwt);

  it("accepts a valid bearer token and attaches its payload as the request user", () => {
    const token = jwt.sign({ sub: "user-1", email: "ana@example.com" });
    const request: FakeRequest = { headers: { authorization: `Bearer ${token}` } };

    expect(guard.canActivate(contextFor(request))).toBe(true);
    expect(request.user).toEqual(expect.objectContaining({ sub: "user-1", email: "ana@example.com" }));
  });

  it.each([
    ["no authorization header", undefined],
    ["a non bearer scheme", "Basic dXNlcjpwYXNz"],
    ["a bearer scheme without token", "Bearer"],
    ["a bearer scheme with an empty token", "Bearer "],
  ])("rejects a request with %s as missing token", (_description, authorization) => {
    const request: FakeRequest =
      authorization === undefined ? { headers: {} } : { headers: { authorization } };

    expect(() => guard.canActivate(contextFor(request))).toThrow(
      new UnauthorizedException("Falta el token de autenticación."),
    );
    expect(request.user).toBeUndefined();
  });

  it("rejects a token signed with another secret", () => {
    const forged = new JwtService({ secret: OTHER_JWT_SECRET }).sign({ sub: "user-1" });
    const request: FakeRequest = { headers: { authorization: `Bearer ${forged}` } };

    expect(() => guard.canActivate(contextFor(request))).toThrow(
      new UnauthorizedException("Token inválido o expirado."),
    );
    expect(request.user).toBeUndefined();
  });

  it("rejects an expired token", () => {
    const expired = jwt.sign({ sub: "user-1" }, { expiresIn: -1 });
    const request: FakeRequest = { headers: { authorization: `Bearer ${expired}` } };

    expect(() => guard.canActivate(contextFor(request))).toThrow(
      new UnauthorizedException("Token inválido o expirado."),
    );
  });
});
