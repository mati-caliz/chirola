import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CertsService } from '../certs/certs.service';
import { WsaaService } from '../arca/wsaa/wsaa.service';
import { WsfeService } from '../arca/wsfe/wsfe.service';
import type { AuthContext } from '../arca/wsfe/wsfe.types';

export interface NumberingStatus {
  salesPoint: number;
  voucherType: number;
  lastInDatabase: number;
  lastInArca: number;
  missingInDatabase: number;
}

@Injectable()
export class ReconciliationService {
  private readonly logger = new Logger(ReconciliationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly certs: CertsService,
    private readonly wsaa: WsaaService,
    private readonly wsfe: WsfeService,
  ) {}

  async checkNumbering(issuer: {
    id: string;
    cuit: string;
  }): Promise<NumberingStatus[]> {
    const grouped = await this.prisma.voucher.groupBy({
      by: ['salesPointId', 'voucherType'],
      where: { issuerId: issuer.id },
      _max: { number: true },
    });
    if (grouped.length === 0) {
      return [];
    }

    const salesPoints = await this.prisma.salesPoint.findMany({
      where: { issuerId: issuer.id },
    });
    const numberById = new Map(salesPoints.map((point) => [point.id, point.number]));

    const auth = await this.buildAuth(issuer);
    const statuses: NumberingStatus[] = [];

    for (const group of grouped) {
      const salesPointNumber = numberById.get(group.salesPointId);
      if (salesPointNumber === undefined) continue;

      const lastInArca = await this.wsfe.getLastAuthorized(
        auth,
        salesPointNumber,
        group.voucherType,
      );
      const lastInDatabase = group._max.number ?? 0;
      const missingInDatabase = Math.max(lastInArca - lastInDatabase, 0);

      if (missingInDatabase > 0) {
        this.logger.warn(
          `Numeración desincronizada ${group.voucherType}-${salesPointNumber}: ARCA tiene ${lastInArca} y la base ${lastInDatabase}.`,
        );
      }

      statuses.push({
        salesPoint: salesPointNumber,
        voucherType: group.voucherType,
        lastInDatabase,
        lastInArca,
        missingInDatabase,
      });
    }

    return statuses;
  }

  private async buildAuth(issuer: {
    id: string;
    cuit: string;
  }): Promise<AuthContext> {
    const credentials = await this.certs.getCredentials(issuer.id);
    const accessTicket = await this.wsaa.getAccessTicket(
      issuer.id,
      credentials,
      'wsfe',
    );
    return {
      cuit: issuer.cuit,
      token: accessTicket.token,
      sign: accessTicket.sign,
    };
  }
}
