import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import type { Issuer } from "@prisma/client";
import { ServiceAuthGuard } from "../service-auth/service-auth.guard";
import { CurrentApiClient } from "../service-auth/current-api-client.decorator";
import type { AuthenticatedApiClient } from "../service-auth/api-client.service";
import { RateLimitGuard } from "../service-auth/rate-limit.guard";
import { IssuersService } from "./issuers.service";
import { ArcaParamsService } from "./arca-params.service";
import { ArcaHealthService } from "./arca-health.service";
import { FiscalConditionType, ArcaHealth } from "@chirola/shared";
import { SalesPointInfo, CurrencyInfo, ExchangeRateInfo } from "../arca/wsfe/wsfe.types";

@Controller("v1")
@UseGuards(ServiceAuthGuard, RateLimitGuard)
export class V1ParamsController {
  constructor(
    private readonly issuers: IssuersService,
    private readonly params: ArcaParamsService,
    private readonly arcaHealth: ArcaHealthService,
  ) {}

  @Get("sales-points")
  async salesPoints(
    @CurrentApiClient() apiClient: AuthenticatedApiClient,
    @Query("issuerId") issuerId: string,
  ): Promise<SalesPointInfo[]> {
    const issuer = await this.resolve(apiClient, issuerId);
    return await this.params.getSalesPoints(issuer);
  }

  @Get("fiscal-condition")
  async fiscalCondition(
    @CurrentApiClient() apiClient: AuthenticatedApiClient,
    @Query("issuerId") issuerId: string,
  ): Promise<{ fiscalCondition: FiscalConditionType | null }> {
    const issuer = await this.resolve(apiClient, issuerId);
    return await this.params.detectFiscalCondition(issuer);
  }

  @Get("currencies")
  async currencies(
    @CurrentApiClient() apiClient: AuthenticatedApiClient,
    @Query("issuerId") issuerId: string,
  ): Promise<CurrencyInfo[]> {
    const issuer = await this.resolve(apiClient, issuerId);
    return await this.params.getCurrencies(issuer);
  }

  @Get("exchange-rate/:currencyId")
  async exchangeRate(
    @CurrentApiClient() apiClient: AuthenticatedApiClient,
    @Query("issuerId") issuerId: string,
    @Param("currencyId") currencyId: string,
  ): Promise<ExchangeRateInfo> {
    const issuer = await this.resolve(apiClient, issuerId);
    return await this.params.getExchangeRate(issuer, currencyId);
  }

  @Get("arca-health")
  async arcaHealthCheck(
    @CurrentApiClient() apiClient: AuthenticatedApiClient,
    @Query("issuerId") issuerId: string,
  ): Promise<ArcaHealth> {
    const issuer = await this.resolve(apiClient, issuerId);
    return await this.arcaHealth.check(issuer.environment);
  }

  private resolve(apiClient: AuthenticatedApiClient, issuerId: string): Promise<Issuer> {
    return this.issuers.getOwned({ apiClientId: apiClient.id }, issuerId);
  }
}
