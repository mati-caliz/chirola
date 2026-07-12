import { ConfigService } from '@nestjs/config';
import { CertMonitorService } from './cert-monitor.service';
import { WebhookService } from '../webhooks/webhook.service';
import { WebhookEvent } from '../webhooks/webhook-events';
import type { PrismaService } from '../prisma/prisma.service';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function config(warningDays: number): ConfigService {
  return {
    get: (key: string, def?: number) =>
      key === 'CERT_EXPIRY_WARNING_DAYS' ? warningDays : def,
  } as unknown as ConfigService;
}

describe('CertMonitorService', () => {
  it('dispara certificate.expiring para certificados próximos a vencer', async () => {
    const validUntil = new Date(Date.now() + 10 * MS_PER_DAY);
    const prisma = {
      certificate: {
        findMany: jest.fn(async () => [{ issuerId: 'issuer-1', validUntil }]),
      },
    } as unknown as PrismaService;
    const webhooks = { dispatch: jest.fn(async () => undefined) } as unknown as WebhookService;
    const service = new CertMonitorService(prisma, webhooks, config(30));

    await service.checkExpiringCertificates();

    expect(webhooks.dispatch).toHaveBeenCalledWith(
      'issuer-1',
      WebhookEvent.CERTIFICATE_EXPIRING,
      expect.objectContaining({ issuerId: 'issuer-1', daysToExpiry: expect.any(Number) }),
    );
  });

  it('no dispara si no hay certificados por vencer', async () => {
    const prisma = {
      certificate: { findMany: jest.fn(async () => []) },
    } as unknown as PrismaService;
    const webhooks = { dispatch: jest.fn() } as unknown as WebhookService;
    const service = new CertMonitorService(prisma, webhooks, config(30));

    await service.checkExpiringCertificates();

    expect(webhooks.dispatch).not.toHaveBeenCalled();
  });
});
