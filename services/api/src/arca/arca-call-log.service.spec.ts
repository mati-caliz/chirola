import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ArcaCallLogService,
  ArcaCallOutcome,
  type ArcaCallLogEntry,
} from './arca-call-log.service';
import type { PrismaService } from '../prisma/prisma.service';

interface StoredCall {
  requestXml: string;
  responseXml: string;
  errorCodes: string | null;
}

function build(retentionDays?: string) {
  const created: StoredCall[] = [];
  const deletedBefore: Date[] = [];
  const prisma = {
    arcaCallLog: {
      create: async ({ data }: { data: StoredCall }) => {
        created.push(data);
        return data;
      },
      deleteMany: async ({
        where,
      }: {
        where: { createdAt: { lt: Date } };
      }) => {
        deletedBefore.push(where.createdAt.lt);
        return { count: 3 };
      },
    },
  } as unknown as PrismaService;

  const config = {
    get: (_key: string, def?: string) => retentionDays ?? def,
  } as unknown as ConfigService;

  return { service: new ArcaCallLogService(prisma, config), created, deletedBefore };
}

const entry = (overrides: Partial<ArcaCallLogEntry> = {}): ArcaCallLogEntry => ({
  issuerId: 'issuer-1',
  service: 'wsfe',
  operation: 'FECAESolicitar',
  httpStatus: 200,
  durationMs: 120,
  outcome: ArcaCallOutcome.SUCCESS,
  requestXml: '<ar:Token>secreto</ar:Token><ar:ImpTotal>1210.00</ar:ImpTotal>',
  responseXml: '<CAE>74000000000001</CAE>',
  ...overrides,
});

describe('ArcaCallLogService (D.2)', () => {
  it('nunca persiste el token de acceso', async () => {
    const { service, created } = build();

    await service.record(entry());

    expect(created[0].requestXml).not.toContain('secreto');
    expect(created[0].requestXml).toContain('<ar:ImpTotal>1210.00</ar:ImpTotal>');
  });

  it('guarda los códigos de error separados por coma', async () => {
    const { service, created } = build();

    await service.record(
      entry({ outcome: ArcaCallOutcome.REJECTED, errorCodes: ['10048', '10051'] }),
    );

    expect(created[0].errorCodes).toBe('10048,10051');
  });

  it('deja el campo de códigos vacío cuando no hubo errores', async () => {
    const { service, created } = build();

    await service.record(entry());

    expect(created[0].errorCodes).toBeNull();
  });

  it('no propaga el fallo de escritura para no romper la emisión', async () => {
    const prisma = {
      arcaCallLog: {
        create: async () => {
          throw new Error('base caída');
        },
      },
    } as unknown as PrismaService;
    const config = {
      get: (_key: string, def?: string) => def,
    } as unknown as ConfigService;

    await expect(
      new ArcaCallLogService(prisma, config).record(entry()),
    ).resolves.toBeUndefined();
  });

  it('purga con el corte que indica la retención configurada', async () => {
    const { service, deletedBefore } = build('7');
    const sevenDaysMs = 7 * 86_400_000;
    const before = Date.now();

    await service.purgeExpired();

    const after = Date.now();
    const cutoff = deletedBefore[0].getTime();
    expect(cutoff).toBeGreaterThanOrEqual(before - sevenDaysMs);
    expect(cutoff).toBeLessThanOrEqual(after - sevenDaysMs);
  });
});

describe('ArcaCallLogService — consulta (D.2)', () => {
  interface Query {
    where: { issuerId: string; operation?: string; outcome?: string };
    take?: number;
  }

  function buildReader(rows: { id: string; issuerId: string | null }[] = []) {
    const queries: Query[] = [];
    const prisma = {
      arcaCallLog: {
        findMany: async (query: Query) => {
          queries.push(query);
          return rows;
        },
        findFirst: async ({ where }: { where: { id: string; issuerId: string } }) =>
          rows.find((row) => row.id === where.id && row.issuerId === where.issuerId) ??
          null,
      },
    } as unknown as PrismaService;
    const config = {
      get: (_key: string, def?: string) => def,
    } as unknown as ConfigService;
    return { service: new ArcaCallLogService(prisma, config), queries };
  }

  it('filtra siempre por el emisor del contexto', async () => {
    const { service, queries } = buildReader();

    await service.listForIssuer('issuer-1');

    expect(queries[0].where.issuerId).toBe('issuer-1');
  });

  it('acota el tamaño de página aunque pidan más', async () => {
    const { service, queries } = buildReader();

    await service.listForIssuer('issuer-1', { limit: 5000 });

    expect(queries[0].take).toBe(200);
  });

  it('deja filtrar por operación y resultado', async () => {
    const { service, queries } = buildReader();

    await service.listForIssuer('issuer-1', {
      operation: 'FECAESolicitar',
      outcome: ArcaCallOutcome.REJECTED,
    });

    expect(queries[0].where.operation).toBe('FECAESolicitar');
    expect(queries[0].where.outcome).toBe(ArcaCallOutcome.REJECTED);
  });

  it('no deja ver una llamada de otro emisor', async () => {
    const { service } = buildReader([{ id: 'call-1', issuerId: 'issuer-2' }]);

    await expect(service.getForIssuer('issuer-1', 'call-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('devuelve la llamada propia', async () => {
    const { service } = buildReader([{ id: 'call-1', issuerId: 'issuer-1' }]);

    expect(await service.getForIssuer('issuer-1', 'call-1')).toMatchObject({
      id: 'call-1',
    });
  });
});
