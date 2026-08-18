import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { IssuersService } from './issuers.service';
import type { PrismaService } from '../prisma/prisma.service';

const input = {
  cuit: '20111111112',
  legalName: 'ACME SRL',
  ivaCondition: 'RESPONSABLE_INSCRIPTO' as const,
  environment: 'homologacion' as const,
};

function prismaWithTransaction(tx: Record<string, unknown>): PrismaService {
  return {
    $transaction: jest.fn(
      async (callback: (client: Record<string, unknown>) => unknown) =>
        callback(tx),
    ),
  } as unknown as PrismaService;
}

describe('IssuersService.createForApiClient', () => {
  it('crea el emisor con un usuario de servicio y lo habilita para el api client', async () => {
    const userUpsert = jest.fn(async () => ({ id: 'user-service-1' }));
    const issuerCreate = jest.fn(async () => ({ id: 'issuer-1' }));
    const grantCreate = jest.fn(async () => ({ id: 'grant-1' }));
    const service = new IssuersService(
      prismaWithTransaction({
        user: { upsert: userUpsert },
        issuer: { create: issuerCreate },
        apiClientIssuer: { create: grantCreate },
      }),
    );

    const issuer = await service.createForApiClient('client-1', input);

    expect(issuer).toEqual({ id: 'issuer-1' });
    expect(userUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { email: 'client-1@service.chirola.internal' },
      }),
    );
    expect(issuerCreate).toHaveBeenCalledWith({
      data: { userId: 'user-service-1', ...input },
    });
    expect(grantCreate).toHaveBeenCalledWith({
      data: { apiClientId: 'client-1', issuerId: 'issuer-1' },
    });
  });

  it('traduce el CUIT duplicado a un conflicto', async () => {
    const duplicate = new Prisma.PrismaClientKnownRequestError('duplicado', {
      code: 'P2002',
      clientVersion: 'test',
    });
    const service = new IssuersService(
      prismaWithTransaction({
        user: { upsert: jest.fn(async () => ({ id: 'user-service-1' })) },
        issuer: {
          create: jest.fn(() => {
            throw duplicate;
          }),
        },
        apiClientIssuer: { create: jest.fn() },
      }),
    );

    await expect(service.createForApiClient('client-1', input)).rejects.toThrow(
      ConflictException,
    );
  });
});
