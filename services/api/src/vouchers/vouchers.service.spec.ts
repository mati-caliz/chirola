import type { IssueVoucher } from '@chirola/shared';
import { VouchersService } from './vouchers.service';
import { IssuerLockService } from './issuer-lock.service';
import { ArcaRejectionError } from '../arca/wsfe/arca-errors';
import type { PrismaService } from '../prisma/prisma.service';
import type { CertsService } from '../certs/certs.service';
import type { WsaaService } from '../arca/wsaa/wsaa.service';
import type { WsfeService } from '../arca/wsfe/wsfe.service';
import type { ApiClientService } from '../service-auth/api-client.service';
import type { WebhookService } from '../webhooks/webhook.service';
import { WebhookEvent } from '../webhooks/webhook-events';
import { VoucherQueuedException } from './voucher-queued.exception';
import { ConfigService } from '@nestjs/config';

interface StoredVoucher {
  id: string;
  issuerId: string;
  salesPointId: string;
  voucherType: number;
  number: number;
  voucherDate: Date;
  netAmount: number;
  ivaAmount: number;
  totalAmount: number;
  cae: string | null;
  caeExpiration: Date | null;
  qrData: string | null;
  salesPoint: { number: number };
}

const ISSUER = { id: 'issuer-1', userId: 'user-1', cuit: '20111111112' };

function buildInput(overrides: Partial<IssueVoucher> = {}): IssueVoucher {
  return {
    issuerId: ISSUER.id,
    salesPoint: 1,
    voucherType: 11,
    concept: 1,
    currency: 'PES',
    exchangeRate: 1,
    recipient: { docType: 99, docNumber: '0', ivaConditionId: 5 },
    items: [{ description: 'Item', quantity: 1, unitPrice: 100, ivaRate: 0 }],
    ...overrides,
  } as IssueVoucher;
}

interface PendingRow {
  id: string;
  issuerId: string;
  idempotencyKey: string | null;
  payload: unknown;
  status: string;
  retryCount: number;
  nextRetryAt: Date;
  lastError: string | null;
}

function buildHarness() {
  const vouchers: StoredVoucher[] = [];
  const idempotency: { issuerId: string; key: string; voucherId: string }[] =
    [];
  const pending: PendingRow[] = [];
  let sequence = 0;

  const prisma = {
    issuer: {
      findUnique: jest.fn(async () => ISSUER),
    },
    pendingVoucher: {
      findUnique: jest.fn(async ({ where }: { where: { issuerId_idempotencyKey: { issuerId: string; idempotencyKey: string } } }) =>
        pending.find(
          (row) =>
            row.issuerId === where.issuerId_idempotencyKey.issuerId &&
            row.idempotencyKey === where.issuerId_idempotencyKey.idempotencyKey,
        ) ?? null,
      ),
      create: jest.fn(async ({ data }: { data: Omit<PendingRow, 'id' | 'status' | 'retryCount'> }) => {
        const row: PendingRow = {
          id: `pending-${pending.length + 1}`,
          status: 'PENDIENTE',
          retryCount: 0,
          ...data,
          idempotencyKey: data.idempotencyKey ?? null,
          lastError: data.lastError ?? null,
        };
        pending.push(row);
        return row;
      }),
      findMany: jest.fn(async () =>
        pending.filter(
          (row) => row.status === 'PENDIENTE' && row.nextRetryAt.getTime() <= Date.now(),
        ),
      ),
      update: jest.fn(async ({ where, data }: { where: { id: string }; data: Partial<PendingRow> }) => {
        const row = pending.find((r) => r.id === where.id);
        if (row) Object.assign(row, data);
        return row;
      }),
      delete: jest.fn(async ({ where }: { where: { id: string } }) => {
        const index = pending.findIndex((r) => r.id === where.id);
        if (index >= 0) pending.splice(index, 1);
        return {};
      }),
    },
    idempotencyRecord: {
      findUnique: jest.fn(async ({ where }: { where: { issuerId_key: { issuerId: string; key: string } } }) =>
        idempotency.find(
          (record) =>
            record.issuerId === where.issuerId_key.issuerId &&
            record.key === where.issuerId_key.key,
        ) ?? null,
      ),
      create: jest.fn(async ({ data }: { data: { issuerId: string; key: string; voucherId: string } }) => {
        idempotency.push(data);
        return data;
      }),
    },
    salesPoint: {
      upsert: jest.fn(async ({ where }: { where: { issuerId_number: { number: number } } }) => ({
        id: `sp-${where.issuerId_number.number}`,
      })),
    },
    voucher: {
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) =>
        vouchers.find((voucher) => voucher.id === where.id) ?? null,
      ),
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
        sequence += 1;
        const stored: StoredVoucher = {
          id: `voucher-${sequence}`,
          issuerId: data.issuerId as string,
          salesPointId: data.salesPointId as string,
          voucherType: data.voucherType as number,
          number: data.number as number,
          voucherDate: data.voucherDate as Date,
          netAmount: data.netAmount as number,
          ivaAmount: data.ivaAmount as number,
          totalAmount: data.totalAmount as number,
          cae: (data.cae as string) ?? null,
          caeExpiration: (data.caeExpiration as Date) ?? null,
          qrData: (data.qrData as string) ?? null,
          salesPoint: { number: 1 },
        };
        vouchers.push(stored);
        return stored;
      }),
    },
  } as unknown as PrismaService;

  const certs = {
    getCredentials: jest.fn(async () => ({
      certPem: 'cert',
      privateKeyPem: 'key',
    })),
  } as unknown as CertsService;

  const wsaa = {
    getAccessTicket: jest.fn(async () => ({
      token: 't',
      sign: 's',
      expiration: new Date(Date.now() + 3_600_000),
      generation: new Date(),
    })),
  } as unknown as WsaaService;

  const wsfe = {
    getLastAuthorized: jest.fn(async (_auth, salesPoint: number, voucherType: number) =>
      vouchers
        .filter((v) => v.voucherType === voucherType && v.salesPoint.number === salesPoint)
        .reduce((max, v) => Math.max(max, v.number), 0),
    ),
    requestCae: jest.fn(async () => ({
      cae: '74000000000001',
      caeVto: new Date('2026-07-22'),
    })),
    queryVoucher: jest.fn(async () => null),
  } as unknown as WsfeService;

  const apiClients = {
    assertIssuerGranted: jest.fn(async () => undefined),
  } as unknown as ApiClientService;

  const webhooks = {
    dispatch: jest.fn(async () => undefined),
  } as unknown as WebhookService;

  const config = {
    get: (key: string, def?: number) =>
      key === 'VOUCHER_RETRY_BASE_MS' ? 0 : def,
  } as unknown as ConfigService;

  const service = new VouchersService(
    prisma,
    certs,
    wsaa,
    wsfe,
    new IssuerLockService(),
    apiClients,
    webhooks,
    config,
  );

  return { service, prisma, certs, wsaa, wsfe, vouchers, pending, webhooks };
}

describe('VouchersService — hardening fiscal (F0)', () => {
  it('idempotency: la misma key no reemite y devuelve el mismo comprobante', async () => {
    const { service, wsfe } = buildHarness();

    const first = await service.issue('user-1', buildInput(), 'key-abc');
    const second = await service.issue('user-1', buildInput(), 'key-abc');

    expect(second.id).toBe(first.id);
    expect(wsfe.requestCae).toHaveBeenCalledTimes(1);
  });

  it('concurrencia: dos emisiones simultáneas del mismo emisor no colisionan de número', async () => {
    const { service } = buildHarness();

    const [a, b] = await Promise.all([
      service.issue('user-1', buildInput()),
      service.issue('user-1', buildInput()),
    ]);

    expect([a.number, b.number].sort()).toEqual([1, 2]);
  });

  it('recuperación de duplicado: si ARCA reporta 10016 recupera el CAE ya emitido', async () => {
    const { service, wsfe } = buildHarness();

    (wsfe.requestCae as jest.Mock).mockRejectedValueOnce(
      new ArcaRejectionError(['10016'], ['(10016) comprobante duplicado']),
    );
    (wsfe.queryVoucher as jest.Mock).mockResolvedValueOnce({
      cae: '74000000000099',
      caeVto: new Date('2026-07-22'),
    });

    const result = await service.issue('user-1', buildInput());

    expect(result.cae).toBe('74000000000099');
    expect(wsfe.queryVoucher).toHaveBeenCalledTimes(1);
  });

  it('rechazo no-duplicado se propaga como error', async () => {
    const { service, wsfe } = buildHarness();

    (wsfe.requestCae as jest.Mock).mockRejectedValueOnce(
      new ArcaRejectionError(['10015'], ['(10015) dato inválido']),
    );

    await expect(service.issue('user-1', buildInput())).rejects.toBeInstanceOf(
      ArcaRejectionError,
    );
  });
});

describe('VouchersService — resiliencia / retry (F2)', () => {
  it('error transitorio de ARCA encola el comprobante y responde 503', async () => {
    const { service, wsfe, pending } = buildHarness();
    (wsfe.requestCae as jest.Mock).mockRejectedValueOnce(new Error('ARCA timeout'));

    await expect(service.issue('user-1', buildInput())).rejects.toBeInstanceOf(
      VoucherQueuedException,
    );
    expect(pending).toHaveLength(1);
    expect(pending[0].status).toBe('PENDIENTE');
  });

  it('el retry scheduler emite el CAE de un comprobante encolado y lo desencola', async () => {
    const { service, wsfe, pending, vouchers, webhooks } = buildHarness();
    (wsfe.requestCae as jest.Mock).mockRejectedValueOnce(new Error('ARCA timeout'));

    await expect(service.issue('user-1', buildInput())).rejects.toBeInstanceOf(
      VoucherQueuedException,
    );
    expect(pending).toHaveLength(1);

    await service.retryPendingVouchers();

    expect(pending).toHaveLength(0);
    expect(vouchers).toHaveLength(1);
    expect(vouchers[0].cae).toBe('74000000000001');
    expect(webhooks.dispatch).toHaveBeenCalledWith(
      'issuer-1',
      WebhookEvent.VOUCHER_ISSUED,
      expect.objectContaining({ voucherId: vouchers[0].id }),
    );
  });

  it('idempotency: reintentar el POST mientras está encolado devuelve 503, sin duplicar la cola', async () => {
    const { service, wsfe, pending } = buildHarness();
    (wsfe.requestCae as jest.Mock).mockRejectedValueOnce(new Error('ARCA timeout'));

    await expect(
      service.issue('user-1', buildInput(), 'key-1'),
    ).rejects.toBeInstanceOf(VoucherQueuedException);
    await expect(
      service.issue('user-1', buildInput(), 'key-1'),
    ).rejects.toBeInstanceOf(VoucherQueuedException);

    expect(pending).toHaveLength(1);
  });

  it('rechazo permanente durante el retry marca ERROR y notifica voucher.failed', async () => {
    const { service, wsfe, pending, webhooks } = buildHarness();
    (wsfe.requestCae as jest.Mock).mockRejectedValueOnce(new Error('ARCA timeout'));
    await expect(service.issue('user-1', buildInput())).rejects.toBeInstanceOf(
      VoucherQueuedException,
    );

    (wsfe.requestCae as jest.Mock).mockRejectedValueOnce(
      new ArcaRejectionError(['10015'], ['(10015) dato inválido']),
    );
    await service.retryPendingVouchers();

    expect(pending[0].status).toBe('ERROR');
    expect(webhooks.dispatch).toHaveBeenCalledWith(
      'issuer-1',
      WebhookEvent.VOUCHER_FAILED,
      expect.objectContaining({ permanent: true }),
    );
  });
});
