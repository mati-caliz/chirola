import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';
import { PrismaService } from '../prisma/prisma.service';

const DEFAULT_PUSH_API_URL = 'https://exp.host/--/api/v2/push/send';
const DEFAULT_TIMEOUT_MS = 10_000;
const UNREGISTERED_DEVICE_ERROR = 'DeviceNotRegistered';

export interface PushMessage {
  title: string;
  body: string;
  data: Record<string, string>;
}

const pushTicketsSchema = z.object({
  data: z.array(
    z.object({
      status: z.string(),
      details: z.object({ error: z.string().optional() }).optional(),
    }),
  ),
});

@Injectable()
export class PushNotificationService {
  private readonly logger = new Logger(PushNotificationService.name);
  private readonly apiUrl: string;
  private readonly timeoutMs: number;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.apiUrl = config.get<string>('PUSH_API_URL', DEFAULT_PUSH_API_URL);
    this.timeoutMs = config.get<number>('PUSH_TIMEOUT_MS', DEFAULT_TIMEOUT_MS);
  }

  async notifyIssuerOwner(issuerId: string, message: PushMessage): Promise<void> {
    try {
      const tokens = await this.prisma.pushToken.findMany({
        where: { user: { issuers: { some: { id: issuerId } } } },
        select: { token: true },
      });
      if (tokens.length > 0) {
        await this.send(tokens.map(({ token }) => token), message);
      }
    } catch (err) {
      this.logger.warn(
        `No se pudo mandar el push del emisor ${issuerId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  private async send(tokens: string[], message: PushMessage): Promise<void> {
    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(tokens.map((to) => ({ to, sound: 'default', ...message }))),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!response.ok) {
      throw new Error(`el servicio de push respondió HTTP ${response.status}`);
    }
    const tickets = pushTicketsSchema.safeParse(await response.json());
    if (!tickets.success) {
      return;
    }
    const unregistered = tokens.filter(
      (_, index) => tickets.data.data[index]?.details?.error === UNREGISTERED_DEVICE_ERROR,
    );
    if (unregistered.length > 0) {
      await this.prisma.pushToken.deleteMany({ where: { token: { in: unregistered } } });
    }
  }
}
