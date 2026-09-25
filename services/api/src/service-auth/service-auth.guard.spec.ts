import { UnauthorizedException } from "@nestjs/common";
import { ExecutionContextHost } from "@nestjs/core/helpers/execution-context-host";
import { instantiateWithDoubles } from "../common/testing/instantiate-with-doubles";
import { ApiClientService, type AuthenticatedApiClient } from "./api-client.service";
import { ServiceAuthGuard } from "./service-auth.guard";

const VALID_KEY = "chk_client-1_secret";
const RESPONDI: AuthenticatedApiClient = { id: "client-1", name: "respondi" };

interface FakeRequest {
  headers: { "x-api-key"?: string; authorization?: string };
  apiClient?: AuthenticatedApiClient;
}

async function guardAccepting(validKey: string): Promise<{ guard: ServiceAuthGuard; seenKeys: string[] }> {
  const seenKeys: string[] = [];
  const authenticate = (rawKey: string): Promise<AuthenticatedApiClient | null> => {
    seenKeys.push(rawKey);
    return Promise.resolve(rawKey === validKey ? RESPONDI : null);
  };
  const guard = await instantiateWithDoubles(ServiceAuthGuard, [
    { token: ApiClientService, value: { authenticate } },
  ]);
  return { guard, seenKeys };
}

function contextFor(request: FakeRequest): ExecutionContextHost {
  return new ExecutionContextHost([request]);
}

describe("ServiceAuthGuard", () => {
  it("authenticates with the x-api-key header and attaches the api client", async () => {
    const { guard, seenKeys } = await guardAccepting(VALID_KEY);
    const request: FakeRequest = { headers: { "x-api-key": VALID_KEY } };

    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
    expect(request.apiClient).toEqual(RESPONDI);
    expect(seenKeys).toEqual([VALID_KEY]);
  });

  it("authenticates with a bearer token when there is no x-api-key header", async () => {
    const { guard } = await guardAccepting(VALID_KEY);
    const request: FakeRequest = { headers: { authorization: `Bearer ${VALID_KEY}` } };

    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
    expect(request.apiClient).toEqual(RESPONDI);
  });

  it("prefers the x-api-key header over the authorization header", async () => {
    const { guard, seenKeys } = await guardAccepting(VALID_KEY);
    const request: FakeRequest = {
      headers: { "x-api-key": VALID_KEY, authorization: "Bearer another-key" },
    };

    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
    expect(seenKeys).toEqual([VALID_KEY]);
  });

  it("falls back to the bearer token when the x-api-key header is empty", async () => {
    const { guard, seenKeys } = await guardAccepting(VALID_KEY);
    const request: FakeRequest = { headers: { "x-api-key": "", authorization: `Bearer ${VALID_KEY}` } };

    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
    expect(seenKeys).toEqual([VALID_KEY]);
  });

  it.each([
    ["no credentials at all", {}],
    ["a non bearer authorization scheme", { authorization: `Basic ${VALID_KEY}` }],
    ["a bearer scheme without token", { authorization: "Bearer" }],
    ["an empty bearer token", { authorization: "Bearer " }],
  ])("rejects a request with %s without querying the api clients", async (_description, headers) => {
    const { guard, seenKeys } = await guardAccepting(VALID_KEY);
    const request: FakeRequest = { headers };

    await expect(guard.canActivate(contextFor(request))).rejects.toThrow(
      new UnauthorizedException("Falta la API key del servicio."),
    );
    expect(seenKeys).toEqual([]);
    expect(request.apiClient).toBeUndefined();
  });

  it("rejects a key the api clients do not recognize", async () => {
    const { guard } = await guardAccepting(VALID_KEY);
    const request: FakeRequest = { headers: { "x-api-key": "chk_client-1_wrong" } };

    await expect(guard.canActivate(contextFor(request))).rejects.toThrow(
      new UnauthorizedException("API key inválida."),
    );
    expect(request.apiClient).toBeUndefined();
  });
});
