import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RecipientIvaCondition, type TaxpayerInfo } from '@chirola/shared';
import { TaxpayersService } from './taxpayers.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { CertsService } from '../certs/certs.service';
import type { WsaaService } from '../arca/wsaa/wsaa.service';
import type { PadronService } from '../arca/padron/padron.service';

const issuer = { id: 'issuer-1', cuit: '20111111112' };

const taxpayer: TaxpayerInfo = {
  cuit: '30707153745',
  legalName: 'ACME SA',
  status: 'ACTIVO',
  ivaConditionId: RecipientIvaCondition.RESPONSABLE_INSCRIPTO,
  address: null,
};

interface CacheRow {
  cuit: string;
  legalName: string;
  status: string;
  ivaConditionId: number;
  address: unknown;
  fetchedAt: Date;
}

function build(options: { cached?: CacheRow } = {}) {
  const upserts: CacheRow[] = [];
  const prisma = {
    taxpayerCache: {
      findUnique: async () => options.cached ?? null,
      upsert: async ({ create }: { create: CacheRow }) => {
        upserts.push(create);
        return create;
      },
    },
  } as unknown as PrismaService;

  const lookups: string[] = [];
  const padron = {
    getTaxpayer: async (_auth: unknown, cuit: string) => {
      lookups.push(cuit);
      return taxpayer;
    },
  } as unknown as PadronService;

  const requestedServices: string[] = [];
  const wsaa = {
    getAccessTicket: async (_id: string, _creds: unknown, service: string) => {
      requestedServices.push(service);
      return { token: 't', sign: 's', expiration: new Date(), generation: new Date() };
    },
  } as unknown as WsaaService;

  const certs = {
    getCredentials: async () => ({ certPem: 'cert', privateKeyPem: 'key' }),
  } as unknown as CertsService;

  const config = {
    get: (_key: string, def: number) => def,
  } as unknown as ConfigService;

  return {
    service: new TaxpayersService(prisma, certs, wsaa, padron, config),
    lookups,
    upserts,
    requestedServices,
  };
}

describe('TaxpayersService', () => {
  it('normaliza el CUIT antes de consultar', async () => {
    const { service, lookups } = build();

    await service.lookup(issuer, '30-70715374-5');

    expect(lookups).toEqual(['30707153745']);
  });

  it('rechaza un CUIT que no tenga 11 dígitos', async () => {
    const { service } = build();

    await expect(service.lookup(issuer, '3070715')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('pide el ticket del servicio de constancia, no el de wsfe', async () => {
    const { service, requestedServices } = build();

    await service.lookup(issuer, '30707153745');

    expect(requestedServices).toEqual(['ws_sr_constancia_inscripcion']);
  });

  it('guarda en caché lo que devuelve el padrón', async () => {
    const { service, upserts } = build();

    await service.lookup(issuer, '30707153745');

    expect(upserts).toHaveLength(1);
    expect(upserts[0].legalName).toBe('ACME SA');
  });

  it('usa la caché vigente sin llamar a ARCA', async () => {
    const { service, lookups } = build({
      cached: {
        cuit: '30707153745',
        legalName: 'ACME SA (cacheado)',
        status: 'ACTIVO',
        ivaConditionId: RecipientIvaCondition.MONOTRIBUTO,
        address: null,
        fetchedAt: new Date(),
      },
    });

    const result = await service.lookup(issuer, '30707153745');

    expect(lookups).toHaveLength(0);
    expect(result.legalName).toBe('ACME SA (cacheado)');
  });

  it('reconsulta cuando la caché está vencida', async () => {
    const longAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
    const { service, lookups } = build({
      cached: {
        cuit: '30707153745',
        legalName: 'ACME SA (viejo)',
        status: 'ACTIVO',
        ivaConditionId: RecipientIvaCondition.MONOTRIBUTO,
        address: null,
        fetchedAt: longAgo,
      },
    });

    const result = await service.lookup(issuer, '30707153745');

    expect(lookups).toEqual(['30707153745']);
    expect(result.legalName).toBe('ACME SA');
  });

  it('descarta un domicilio cacheado con forma inesperada', async () => {
    const { service } = build({
      cached: {
        cuit: '30707153745',
        legalName: 'ACME SA',
        status: 'ACTIVO',
        ivaConditionId: RecipientIvaCondition.RESPONSABLE_INSCRIPTO,
        address: { inesperado: true },
        fetchedAt: new Date(),
      },
    });

    const result = await service.lookup(issuer, '30707153745');

    expect(result.address).toBeNull();
  });
});
