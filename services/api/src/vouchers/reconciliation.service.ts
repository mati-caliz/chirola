import { Inject, Injectable, Logger } from "@nestjs/common";
import type { ArcaIssuer } from "../arca/arca-environment";
import { IssuerAuthService } from "../issuer-arca/issuer-auth.service";
import { WsfeService } from "../arca/wsfe/wsfe.service";
import type { IssuerAuthenticator, WsfeGateway } from "./voucher-ports";
import { VOUCHER_TABLES, type NumberingTables } from "./voucher-tables";

export type LastAuthorizedLookup = Pick<WsfeGateway, "getLastAuthorized">;

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
    @Inject(VOUCHER_TABLES) private readonly tables: NumberingTables,
    @Inject(IssuerAuthService) private readonly issuerAuth: IssuerAuthenticator,
    @Inject(WsfeService) private readonly wsfe: LastAuthorizedLookup,
  ) {}

  async checkNumbering(issuer: ArcaIssuer): Promise<NumberingStatus[]> {
    const grouped = await this.tables.voucher.groupBy({
      by: ["salesPointId", "voucherType"],
      where: { issuerId: issuer.id },
      _max: { number: true },
    });
    if (grouped.length === 0) {
      return [];
    }

    const salesPoints = await this.tables.salesPoint.findMany({
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
