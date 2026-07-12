import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  upcomingVencimientos,
  VencimientoStatus,
  type Vencimiento,
} from './vencimiento-calendar';

const DEFAULT_HORIZON_DAYS = 90;
const CERT_WARNING_DAYS = 30;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface FiscalAlerts {
  vencimientos: Vencimiento[];
  certificate: { validUntil: string; daysToExpiry: number } | null;
}

@Injectable()
export class FiscalAlertsService {
  constructor(private readonly prisma: PrismaService) {}

  getVencimientos(cuit: string, from?: Date, to?: Date): Vencimiento[] {
    const start = from ?? new Date();
    const end = to ?? new Date(Date.now() + DEFAULT_HORIZON_DAYS * MS_PER_DAY);
    return upcomingVencimientos(cuit, start, end);
  }

  async getAlerts(issuer: { id: string; cuit: string }): Promise<FiscalAlerts> {
    const vencimientos = this.getVencimientos(issuer.cuit).filter(
      (item) => item.status !== VencimientoStatus.UPCOMING,
    );
    return {
      vencimientos,
      certificate: await this.certificateAlert(issuer.id),
    };
  }

  private async certificateAlert(
    issuerId: string,
  ): Promise<{ validUntil: string; daysToExpiry: number } | null> {
    const certificate = await this.prisma.certificate.findUnique({
      where: { issuerId },
    });
    if (!certificate?.validUntil) {
      return null;
    }
    const daysToExpiry = Math.ceil(
      (certificate.validUntil.getTime() - Date.now()) / MS_PER_DAY,
    );
    if (daysToExpiry > CERT_WARNING_DAYS) {
      return null;
    }
    return {
      validUntil: certificate.validUntil.toISOString(),
      daysToExpiry,
    };
  }
}
