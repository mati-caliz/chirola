import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { WebhookService } from '../webhooks/webhook.service';
import { WebhookEvent } from '../webhooks/webhook-events';

const DEFAULT_WARNING_DAYS = 30;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

@Injectable()
export class CertMonitorService {
  private readonly logger = new Logger(CertMonitorService.name);
  private readonly warningDays: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly webhooks: WebhookService,
    config: ConfigService,
  ) {
    this.warningDays = config.get<number>(
      'CERT_EXPIRY_WARNING_DAYS',
      DEFAULT_WARNING_DAYS,
    );
  }

  @Cron(CronExpression.EVERY_DAY_AT_7AM)
  async checkExpiringCertificates(): Promise<void> {
    const threshold = new Date(Date.now() + this.warningDays * MS_PER_DAY);
    const certificates = await this.prisma.certificate.findMany({
      where: { validUntil: { not: null, lte: threshold } },
    });

    for (const certificate of certificates) {
      if (!certificate.validUntil) {
        continue;
      }
      const daysToExpiry = Math.ceil(
        (certificate.validUntil.getTime() - Date.now()) / MS_PER_DAY,
      );
      this.logger.warn(
        `Certificado del emisor ${certificate.issuerId} vence en ${daysToExpiry} días.`,
      );
      await this.webhooks.dispatch(
        certificate.issuerId,
        WebhookEvent.CERTIFICATE_EXPIRING,
        {
          issuerId: certificate.issuerId,
          validUntil: certificate.validUntil.toISOString(),
          daysToExpiry,
        },
      );
    }
  }
}
