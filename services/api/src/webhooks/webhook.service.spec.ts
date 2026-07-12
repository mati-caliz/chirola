import { createHmac } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { WebhookService } from './webhook.service';
import { WebhookEvent, SIGNATURE_HEADER, EVENT_HEADER } from './webhook-events';
import type { PrismaService } from '../prisma/prisma.service';

function config(overrides: Record<string, number> = {}): ConfigService {
  const values: Record<string, number> = {
    WEBHOOK_MAX_ATTEMPTS: 3,
    WEBHOOK_BASE_DELAY_MS: 0,
    WEBHOOK_TIMEOUT_MS: 1_000,
    ...overrides,
  };
  return {
    get: (key: string, def?: number) => values[key] ?? def,
  } as unknown as ConfigService;
}

function prismaWith(endpoints: { url: string; secret: string }[]): PrismaService {
  return {
    apiClientIssuer: {
      findMany: jest.fn(async () => [{ apiClientId: 'client-1' }]),
    },
    webhookEndpoint: {
      findMany: jest.fn(async () => endpoints),
    },
  } as unknown as PrismaService;
}

describe('WebhookService', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('firma el payload con HMAC-SHA256 del secret del endpoint', async () => {
    const fetchMock: jest.Mock = jest.fn(
      async () => new Response(null, { status: 200 }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;
    const secret = 'top-secret';
    const service = new WebhookService(
      prismaWith([{ url: 'https://hook.test/x', secret }]),
      config(),
    );

    await service.dispatch('issuer-1', WebhookEvent.VOUCHER_ISSUED, { id: 'v1' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    const body = init.body as string;
    const headers = init.headers as Record<string, string>;
    const expected = createHmac('sha256', secret).update(body).digest('hex');
    expect(headers[SIGNATURE_HEADER]).toBe(`sha256=${expected}`);
    expect(headers[EVENT_HEADER]).toBe(WebhookEvent.VOUCHER_ISSUED);
    expect(JSON.parse(body)).toMatchObject({
      event: WebhookEvent.VOUCHER_ISSUED,
      issuerId: 'issuer-1',
      data: { id: 'v1' },
    });
  });

  it('reintenta ante respuesta no-OK hasta que responde 200', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 500 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));
    global.fetch = fetchMock as unknown as typeof fetch;
    const service = new WebhookService(
      prismaWith([{ url: 'https://hook.test/x', secret: 's' }]),
      config(),
    );

    await service.dispatch('issuer-1', WebhookEvent.VOUCHER_FAILED, {});

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('no dispara si el emisor no tiene grants con webhook', async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    const prisma = {
      apiClientIssuer: { findMany: jest.fn(async () => []) },
      webhookEndpoint: { findMany: jest.fn() },
    } as unknown as PrismaService;
    const service = new WebhookService(prisma, config());

    await service.dispatch('issuer-1', WebhookEvent.VOUCHER_ISSUED, {});

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
