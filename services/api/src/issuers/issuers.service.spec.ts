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

function prismaWithDelegates(delegates: Record<string, unknown>): PrismaService {
  return delegates as unknown as PrismaService;
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
      data: { userId: 'user-service-1', ...input, commercialAddress: null },
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

describe('IssuersService.createForApiClient con domicilio comercial', () => {
  it('guarda el domicilio comercial cuando viene en el alta', async () => {
    const issuerCreate = jest.fn(async () => ({ id: 'issuer-1' }));
    const service = new IssuersService(
      prismaWithTransaction({
        user: { upsert: jest.fn(async () => ({ id: 'user-service-1' })) },
        issuer: { create: issuerCreate },
        apiClientIssuer: { create: jest.fn() },
      }),
    );

    await service.createForApiClient('client-1', {
      ...input,
      commercialAddress: 'Av. Corrientes 1234, CABA',
    });

    expect(issuerCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ commercialAddress: 'Av. Corrientes 1234, CABA' }),
    });
  });
});

describe('IssuersService.updateCommercialAddress', () => {
  it('actualiza sólo el domicilio comercial del emisor', async () => {
    const issuerUpdate = jest.fn(async () => ({ id: 'issuer-1' }));
    const service = new IssuersService(
      prismaWithDelegates({ issuer: { update: issuerUpdate } }),
    );

    await service.updateCommercialAddress('issuer-1', { commercialAddress: null });

    expect(issuerUpdate).toHaveBeenCalledWith({
      where: { id: 'issuer-1' },
      data: { commercialAddress: null },
    });
  });
});

describe('IssuersService.getWithCertificate', () => {
  const storedIssuer = {
    id: 'issuer-1',
    cuit: '20111111112',
    legalName: 'ACME SRL',
    commercialAddress: 'Av. Corrientes 1234, CABA',
    ivaCondition: 'RESPONSABLE_INSCRIPTO',
    environment: 'produccion',
    onboardingStatus: 'READY',
  };
  const validUntil = new Date('2027-09-24T00:00:00.000Z');

  function serviceReturning(certificate: Record<string, unknown> | null) {
    return new IssuersService(
      prismaWithDelegates({
        issuer: { findUnique: jest.fn(async () => ({ ...storedIssuer, certificate })) },
      }),
    );
  }

  it('expone el vencimiento del certificado activo y el domicilio comercial', async () => {
    const issuer = await serviceReturning({
      alias: 'acme',
      validUntil,
      certPem: 'PEM',
      holderCuit: '20111111112',
    }).getWithCertificate('issuer-1');

    expect(issuer).toEqual(
      expect.objectContaining({
        id: 'issuer-1',
        cuit: '20111111112',
        legalName: 'ACME SRL',
        commercialAddress: 'Av. Corrientes 1234, CABA',
        ivaCondition: 'RESPONSABLE_INSCRIPTO',
        environment: 'produccion',
        certificateValidUntil: validUntil,
        certificate: expect.objectContaining({ validUntil, status: 'ready' }),
      }),
    );
  });

  it('devuelve el vencimiento en null si el certificado todavía no se cargó', async () => {
    const issuer = await serviceReturning({
      alias: 'acme',
      validUntil: null,
      certPem: null,
      holderCuit: null,
    }).getWithCertificate('issuer-1');

    expect(issuer.certificateValidUntil).toBeNull();
  });

  it('devuelve el vencimiento en null si el emisor no tiene certificado', async () => {
    const issuer = await serviceReturning(null).getWithCertificate('issuer-1');

    expect(issuer.certificateValidUntil).toBeNull();
    expect(issuer.certificate).toBeNull();
  });
});
