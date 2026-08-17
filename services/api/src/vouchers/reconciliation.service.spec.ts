import { ReconciliationService } from './reconciliation.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { CertsService } from '../certs/certs.service';
import type { WsaaService } from '../arca/wsaa/wsaa.service';
import type { WsfeService } from '../arca/wsfe/wsfe.service';

const issuer = { id: 'issuer-1', cuit: '20111111112' };

interface Group {
  salesPointId: string;
  voucherType: number;
  _max: { number: number | null };
}

function build(options: {
  groups?: Group[];
  lastInArca?: Record<number, number>;
}) {
  const prisma = {
    voucher: {
      groupBy: async () => options.groups ?? [],
    },
    salesPoint: {
      findMany: async () => [{ id: 'sp-1', number: 1 }],
    },
  } as unknown as PrismaService;

  const wsfe = {
    getLastAuthorized: async (
      _auth: unknown,
      _salesPoint: number,
      voucherType: number,
    ) => options.lastInArca?.[voucherType] ?? 0,
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

  return new ReconciliationService(prisma, certs, wsaa, wsfe);
}

describe('ReconciliationService', () => {
  it('no consulta ARCA si el emisor no tiene comprobantes', async () => {
    const service = build({ groups: [] });

    expect(await service.checkNumbering(issuer)).toEqual([]);
  });

  it('reporta cero faltantes cuando la base está al día', async () => {
    const service = build({
      groups: [{ salesPointId: 'sp-1', voucherType: 11, _max: { number: 42 } }],
      lastInArca: { 11: 42 },
    });

    const [status] = await service.checkNumbering(issuer);

    expect(status.missingInDatabase).toBe(0);
    expect(status.lastInArca).toBe(42);
    expect(status.lastInDatabase).toBe(42);
  });

  it('detecta comprobantes que ARCA autorizó y la base no tiene', async () => {
    const service = build({
      groups: [{ salesPointId: 'sp-1', voucherType: 11, _max: { number: 40 } }],
      lastInArca: { 11: 43 },
    });

    const [status] = await service.checkNumbering(issuer);

    expect(status.missingInDatabase).toBe(3);
  });

  it('no reporta faltantes negativos si la base va adelante', async () => {
    const service = build({
      groups: [{ salesPointId: 'sp-1', voucherType: 11, _max: { number: 50 } }],
      lastInArca: { 11: 42 },
    });

    const [status] = await service.checkNumbering(issuer);

    expect(status.missingInDatabase).toBe(0);
  });

  it('revisa cada combinación de punto de venta y tipo', async () => {
    const service = build({
      groups: [
        { salesPointId: 'sp-1', voucherType: 11, _max: { number: 10 } },
        { salesPointId: 'sp-1', voucherType: 13, _max: { number: 2 } },
      ],
      lastInArca: { 11: 12, 13: 2 },
    });

    const statuses = await service.checkNumbering(issuer);

    expect(statuses).toHaveLength(2);
    expect(statuses[0].missingInDatabase).toBe(2);
    expect(statuses[1].missingInDatabase).toBe(0);
  });

  it('ignora grupos cuyo punto de venta ya no existe', async () => {
    const service = build({
      groups: [{ salesPointId: 'sp-borrado', voucherType: 11, _max: { number: 5 } }],
      lastInArca: { 11: 9 },
    });

    expect(await service.checkNumbering(issuer)).toEqual([]);
  });
});
