import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import {
  EVENT_HEADER,
  SIGNATURE_HEADER,
  WebhookEventType,
} from './webhook-events';

const DEFAULT_MAX_ATTEMPTS = 5;
const DEFAULT_BASE_DELAY_MS = 1_000;
const DEFAULT_TIMEOUT_MS = 10_000;

const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);
  private readonly maxAttempts: number;
  private readonly baseDelayMs: number;
  private readonly timeoutMs: number;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.maxAttempts = config.get<number>(
      'WEBHOOK_MAX_ATTEMPTS',
      DEFAULT_MAX_ATTEMPTS,
    );
    this.baseDelayMs = config.get<number>(
      'WEBHOOK_BASE_DELAY_MS',
      DEFAULT_BASE_DELAY_MS,
    );
    this.timeoutMs = config.get<number>(
      'WEBHOOK_TIMEOUT_MS',
      DEFAULT_TIMEOUT_MS,
    );
  }

  async dispatch(
    issuerId: string,
    event: WebhookEventType,
    data: Record<string, unknown>,
  ): Promise<void> {
    const grants = await this.prisma.apiClientIssuer.findMany({
      where: { issuerId },
      select: { apiClientId: true },
    });
    if (grants.length === 0) {
      return;
    }

    const endpoints = await this.prisma.webhookEndpoint.findMany({
      where: {
        active: true,
        apiClientId: { in: grants.map((grant) => grant.apiClientId) },
      },
    });

    const body = JSON.stringify({
      event,
      issuerId,
      data,
      timestamp: new Date().toISOString(),
    });

    await Promise.all(
      endpoints.map((endpoint) =>
        this.deliver(endpoint.url, endpoint.secret, event, body),
      ),
    );
  }

  private async deliver(
    url: string,
    secret: string,
    event: WebhookEventType,
    body: string,
  ): Promise<void> {
    const signature = createHmac('sha256', secret).update(body).digest('hex');

    for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            [EVENT_HEADER]: event,
            [SIGNATURE_HEADER]: `sha256=${signature}`,
          },
          body,
          signal: AbortSignal.timeout(this.timeoutMs),
        });
        if (response.ok) {
          return;
        }
        this.logger.warn(
          `Webhook ${event} a ${url} respondió HTTP ${response.status} (intento ${attempt})`,
        );
      } catch (err) {
        this.logger.warn(
          `Webhook ${event} a ${url} falló (intento ${attempt}): ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
      if (attempt < this.maxAttempts) {
        await delay(this.baseDelayMs * 2 ** (attempt - 1));
      }
    }
    this.logger.error(
      `Webhook ${event} a ${url} agotó ${this.maxAttempts} intentos.`,
    );
  }
}
