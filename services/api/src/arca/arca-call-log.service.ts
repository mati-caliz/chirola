import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { redactArcaXml, truncateXml } from './arca-call-redaction';

export const ArcaCallOutcome = {
  SUCCESS: 'SUCCESS',
  REJECTED: 'REJECTED',
  FAULT: 'FAULT',
  NETWORK_ERROR: 'NETWORK_ERROR',
} as const;

export type ArcaCallOutcomeName =
  (typeof ArcaCallOutcome)[keyof typeof ArcaCallOutcome];

export interface ArcaCallLogEntry {
  issuerId: string | null;
  service: string;
  operation: string;
  httpStatus: number;
  durationMs: number;
  outcome: ArcaCallOutcomeName;
  errorCodes?: string[];
  requestXml: string;
  responseXml: string;
}

const MAX_XML_LENGTH = 20_000;
const DEFAULT_RETENTION_DAYS = 30;
const MILLISECONDS_PER_DAY = 86_400_000;

@Injectable()
export class ArcaCallLogService {
  private readonly logger = new Logger(ArcaCallLogService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async record(entry: ArcaCallLogEntry): Promise<void> {
    try {
      await this.prisma.arcaCallLog.create({
        data: {
          issuerId: entry.issuerId,
          service: entry.service,
          operation: entry.operation,
          httpStatus: entry.httpStatus,
          durationMs: entry.durationMs,
          outcome: entry.outcome,
          errorCodes: entry.errorCodes?.length
            ? entry.errorCodes.join(',')
            : null,
          requestXml: this.sanitize(entry.requestXml),
          responseXml: this.sanitize(entry.responseXml),
        },
      });
    } catch (err) {
      this.logger.warn(
        `No se pudo registrar la llamada ${entry.operation}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  async purgeExpired(): Promise<number> {
    const retentionDays = Number(
      this.config.get<string>(
        'ARCA_CALL_LOG_RETENTION_DAYS',
        String(DEFAULT_RETENTION_DAYS),
      ),
    );
    const cutoff = new Date(Date.now() - retentionDays * MILLISECONDS_PER_DAY);
    const { count } = await this.prisma.arcaCallLog.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });
    return count;
  }

  private sanitize(xml: string): string {
    return truncateXml(redactArcaXml(xml), MAX_XML_LENGTH);
  }
}
