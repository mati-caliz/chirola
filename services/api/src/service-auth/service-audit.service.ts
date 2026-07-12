import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditEntry {
  apiClientId: string;
  issuerId?: string;
  method: string;
  path: string;
  outcome: 'success' | 'error';
  voucherId?: string;
  detail?: string;
}

@Injectable()
export class ServiceAuditService {
  private readonly logger = new Logger(ServiceAuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(entry: AuditEntry): Promise<void> {
    try {
      await this.prisma.serviceAuditLog.create({ data: entry });
    } catch (err) {
      this.logger.error('No se pudo registrar la auditoría de servicio', err as Error);
    }
  }
}
