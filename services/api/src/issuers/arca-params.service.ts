import { Injectable } from "@nestjs/common";
import { inferFiscalCondition, type FiscalConditionType } from "@chirola/shared";
import { IssuerAuthService } from "../issuer-arca/issuer-auth.service";
import { WsfeService } from "../arca/wsfe/wsfe.service";
import type { ArcaIssuer } from "../arca/arca-environment";
import type { CurrencyInfo, ExchangeRateInfo, SalesPointInfo } from "../arca/wsfe/wsfe.types";

@Injectable()
export class ArcaParamsService {
  constructor(
    private readonly issuerAuth: IssuerAuthService,
    private readonly wsfe: WsfeService,
  ) {}

  async getSalesPoints(issuer: ArcaIssuer): Promise<SalesPointInfo[]> {
    const auth = await this.issuerAuth.buildAuth(issuer);
    return this.wsfe.getSalesPoints(auth);
  }

  async getCurrencies(issuer: ArcaIssuer): Promise<CurrencyInfo[]> {
    const auth = await this.issuerAuth.buildAuth(issuer);
    return this.wsfe.getCurrencies(auth);
  }

  async getExchangeRate(issuer: ArcaIssuer, currencyId: string): Promise<ExchangeRateInfo> {
    const auth = await this.issuerAuth.buildAuth(issuer);
    return this.wsfe.getExchangeRate(auth, currencyId);
  }

  async detectFiscalCondition(issuer: ArcaIssuer): Promise<{ fiscalCondition: FiscalConditionType | null }> {
    const auth = await this.issuerAuth.buildAuth(issuer);
    const voucherTypeIds = await this.wsfe.getVoucherTypeIds(auth);
    return { fiscalCondition: inferFiscalCondition(voucherTypeIds) };
  }
}
