import { Injectable, Logger } from "@nestjs/common";
import type { ArcaIssuer } from "../arca/arca-environment";
import { IssuerAuthService } from "../issuer-arca/issuer-auth.service";
import { PrismaService } from "../prisma/prisma.service";
import { WsfeService } from "../arca/wsfe/wsfe.service";

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
    private readonly issuerAuth: IssuerAuthService,
    private readonly wsfe: WsfeService,
  ) {}

  async checkNumbering(issuer: ArcaIssuer): Promise<NumberingStatus[]> {
    const grouped = await this.prisma.voucher.groupBy({
      by: ["salesPointId", "voucherType"],
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

    const auth = await this.issuerAuth.buildAuth(issuer);
    const statuses: NumberingStatus[] = [];

    for (const group of grouped) {
      const salesPointNumber = numberById.get(group.salesPointId);
      if (salesPointNumber === undefined) continue;

      const lastInArca = await this.wsfe.getLastAuthorized(auth, salesPointNumber, group.voucherType);
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
}
