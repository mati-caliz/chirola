import { ForbiddenException } from '@nestjs/common';
import { ApiClientService } from './api-client.service';
import { ApiKeyService } from './api-key.service';
import type { PrismaService } from '../prisma/prisma.service';

function buildHarness(overrides: {
  findClient?: jest.Mock;
  findGrant?: jest.Mock;
} = {}) {
  const prisma = {
    apiClient: {
      findUnique: overrides.findClient ?? jest.fn(async () => null),
    },
    apiClientIssuer: {
      findUnique: overrides.findGrant ?? jest.fn(async () => null),
    },
  } as unknown as PrismaService;
  const apiKeys = new ApiKeyService();
  return { service: new ApiClientService(prisma, apiKeys), apiKeys };
}

describe('ApiClientService', () => {
  it('autentica un cliente activo con secreto válido', async () => {
    const apiKeys = new ApiKeyService();
    const secret = apiKeys.generateSecret();
    const client = {
      id: 'client-1',
      name: 'gastronova',
      keyHash: apiKeys.hashSecret(secret),
      active: true,
    };
    const { service } = buildHarness({
      findClient: jest.fn(async () => client),
    });

    const result = await service.authenticate(apiKeys.compose('client-1', secret));
    expect(result).toEqual({ id: 'client-1', name: 'gastronova' });
  });

  it('rechaza cliente inactivo', async () => {
    const apiKeys = new ApiKeyService();
    const secret = apiKeys.generateSecret();
    const { service } = buildHarness({
      findClient: jest.fn(async () => ({
        id: 'client-1',
        name: 'x',
        keyHash: apiKeys.hashSecret(secret),
        active: false,
      })),
    });
    expect(
      await service.authenticate(apiKeys.compose('client-1', secret)),
    ).toBeNull();
  });

  it('rechaza secreto incorrecto', async () => {
    const apiKeys = new ApiKeyService();
    const { service } = buildHarness({
      findClient: jest.fn(async () => ({
        id: 'client-1',
        name: 'x',
        keyHash: apiKeys.hashSecret(apiKeys.generateSecret()),
        active: true,
      })),
    });
    expect(
      await service.authenticate(apiKeys.compose('client-1', 'wrong')),
    ).toBeNull();
  });

  it('rechaza key mal formada', async () => {
    const { service } = buildHarness();
    expect(await service.authenticate('no-separator')).toBeNull();
  });

  it('assertIssuerGranted pasa si existe grant', async () => {
    const { service } = buildHarness({
      findGrant: jest.fn(async () => ({ id: 'grant-1' })),
    });
    await expect(
      service.assertIssuerGranted('client-1', 'issuer-1'),
    ).resolves.toBeUndefined();
  });

  it('assertIssuerGranted lanza Forbidden si no hay grant', async () => {
    const { service } = buildHarness();
    await expect(
      service.assertIssuerGranted('client-1', 'issuer-1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
