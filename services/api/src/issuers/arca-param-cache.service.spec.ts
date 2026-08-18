import { ConfigService } from '@nestjs/config';
import { ArcaParamType, localArcaParams, type ArcaParam } from '@chirola/shared';
import { ArcaParamCacheService } from './arca-param-cache.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { CertsService } from '../certs/certs.service';
import type { WsaaService } from '../arca/wsaa/wsaa.service';
import type { WsfeService } from '../arca/wsfe/wsfe.service';

const issuer = {
  id: 'issuer-1',
  cuit: '20111111112',
  environment: 'homologacion',
};

const fromArca: ArcaParam[] = [
  { id: 1, description: 'Impuestos nacionales' },
  { id: 2, description: 'Impuestos provinciales' },
];

interface CacheRow {
  entries: unknown;
  fetchedAt: Date;
}

function build(options: { cached?: CacheRow; arcaFails?: boolean } = {}) {
  const upserts: unknown[] = [];
  const prisma = {
    arcaParamCache: {
      findUnique: async () => options.cached ?? null,
      upsert: async ({ create }: { create: { entries: unknown } }) => {
        upserts.push(create.entries);
        return create;
      },
    },
  } as unknown as PrismaService;

  let arcaCalls = 0;
  const wsfe = {
    getTributeTypes: async () => {
      arcaCalls += 1;
      if (options.arcaFails) throw new Error('ARCA caído');
      return fromArca;
    },
  } as unknown as WsfeService;

  const wsaa = {
    getAccessTicket: async () => ({
      token: 't',
      sign: 's',
      expiration: new Date(),
      generation: new Date(),
    }),
  } as unknown as WsaaService;

  const certs = {
    getCredentials: async () => ({ certPem: 'cert', privateKeyPem: 'key' }),
  } as unknown as CertsService;

  const config = {
    get: (_key: string, def: number) => def,
  } as unknown as ConfigService;

  return {
    service: new ArcaParamCacheService(prisma, certs, wsaa, wsfe, config),
    upserts,
    arcaCalls: () => arcaCalls,
  };
}

describe('ArcaParamCacheService', () => {
  it('consulta ARCA y guarda en caché cuando no hay nada', async () => {
    const { service, upserts } = build();

    const result = await service.get(issuer, ArcaParamType.TRIBUTE_TYPES);

    expect(result).toEqual(fromArca);
    expect(upserts).toEqual([fromArca]);
  });

  it('usa la caché vigente sin llamar a ARCA', async () => {
    const { service, arcaCalls } = build({
      cached: { entries: fromArca, fetchedAt: new Date() },
    });

    const result = await service.get(issuer, ArcaParamType.TRIBUTE_TYPES);

    expect(arcaCalls()).toBe(0);
    expect(result).toEqual(fromArca);
  });

  it('refresca cuando la caché venció', async () => {
    const longAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
    const { service, arcaCalls } = build({
      cached: { entries: [{ id: 9, description: 'viejo' }], fetchedAt: longAgo },
    });

    const result = await service.get(issuer, ArcaParamType.TRIBUTE_TYPES);

    expect(arcaCalls()).toBe(1);
    expect(result).toEqual(fromArca);
  });

  it('cae a la caché vencida si ARCA no responde', async () => {
    const longAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
    const stale = [{ id: 9, description: 'viejo pero servible' }];
    const { service } = build({
      cached: { entries: stale, fetchedAt: longAgo },
      arcaFails: true,
    });

    const result = await service.get(issuer, ArcaParamType.TRIBUTE_TYPES);

    expect(result).toEqual(stale);
  });

  it('cae a los valores locales si ARCA falla y no hay caché', async () => {
    const { service } = build({ arcaFails: true });

    const result = await service.get(issuer, ArcaParamType.TRIBUTE_TYPES);

    expect(result).toEqual(localArcaParams.TRIBUTE_TYPES);
  });

  it('ignora una caché con forma inesperada y consulta ARCA', async () => {
    const { service, arcaCalls } = build({
      cached: { entries: { roto: true }, fetchedAt: new Date() },
    });

    const result = await service.get(issuer, ArcaParamType.TRIBUTE_TYPES);

    expect(arcaCalls()).toBe(1);
    expect(result).toEqual(fromArca);
  });
});
