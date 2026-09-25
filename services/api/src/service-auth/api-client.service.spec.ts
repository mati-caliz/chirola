import { ForbiddenException } from "@nestjs/common";
import { ApiClientService } from "./api-client.service";
import { ApiKeyService } from "./api-key.service";
import { PrismaService } from "../prisma/prisma.service";
import { instantiateWithDoubles } from "../common/testing/instantiate-with-doubles";

function resolvedWith(value: unknown): jest.Mock {
  return jest.fn(() => Promise.resolve(value));
}

async function buildHarness(
  overrides: {
    findClient?: jest.Mock;
    findGrant?: jest.Mock;
  } = {},
) {
  const prisma = {
    apiClient: {
      findUnique: overrides.findClient ?? resolvedWith(null),
    },
    apiClientIssuer: {
      findUnique: overrides.findGrant ?? resolvedWith(null),
    },
  };
  const apiKeys = new ApiKeyService();
  const service = await instantiateWithDoubles(ApiClientService, [
    { token: PrismaService, value: prisma },
    { token: ApiKeyService, value: apiKeys },
  ]);
  return { service, apiKeys };
}

describe("ApiClientService", () => {
  it("autentica un cliente activo con secreto válido", async () => {
    const apiKeys = new ApiKeyService();
    const secret = apiKeys.generateSecret();
    const client = {
      id: "client-1",
      name: "gastronova",
      keyHash: apiKeys.hashSecret(secret),
      active: true,
    };
    const { service } = await buildHarness({
      findClient: resolvedWith(client),
    });

    const result = await service.authenticate(apiKeys.compose("client-1", secret));
    expect(result).toEqual({ id: "client-1", name: "gastronova" });
  });

  it("rechaza cliente inactivo", async () => {
    const apiKeys = new ApiKeyService();
    const secret = apiKeys.generateSecret();
    const { service } = await buildHarness({
      findClient: resolvedWith({
        id: "client-1",
        name: "x",
        keyHash: apiKeys.hashSecret(secret),
        active: false,
      }),
    });
    expect(await service.authenticate(apiKeys.compose("client-1", secret))).toBeNull();
  });

  it("rechaza secreto incorrecto", async () => {
    const apiKeys = new ApiKeyService();
    const { service } = await buildHarness({
      findClient: resolvedWith({
        id: "client-1",
        name: "x",
        keyHash: apiKeys.hashSecret(apiKeys.generateSecret()),
        active: true,
      }),
    });
    expect(await service.authenticate(apiKeys.compose("client-1", "wrong"))).toBeNull();
  });

  it("rechaza key mal formada", async () => {
    const { service } = await buildHarness();
    expect(await service.authenticate("no-separator")).toBeNull();
  });

  it("assertIssuerGranted pasa si existe grant", async () => {
    const { service } = await buildHarness({
      findGrant: resolvedWith({ id: "grant-1" }),
    });
    await expect(service.assertIssuerGranted("client-1", "issuer-1")).resolves.toBeUndefined();
  });

  it("assertIssuerGranted lanza Forbidden si no hay grant", async () => {
    const { service } = await buildHarness();
    await expect(service.assertIssuerGranted("client-1", "issuer-1")).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
