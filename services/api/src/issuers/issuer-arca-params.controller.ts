import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import {
  arcaParamTypeSchema,
  type ArcaHealth,
  type ArcaParam,
  type ArcaParamTypeName,
  type FiscalConditionType,
} from "@chirola/shared";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import type { JwtPayload } from "../auth/auth.service";
import { CurrencyInfo, ExchangeRateInfo } from "../arca/wsfe/wsfe.types";
import { IssuersService } from "./issuers.service";
import { ArcaParamsService } from "./arca-params.service";
import { ArcaParamCacheService } from "./arca-param-cache.service";
import { ArcaHealthService } from "./arca-health.service";

@Controller("issuers")
@UseGuards(JwtAuthGuard)
export class IssuerArcaParamsController {
  constructor(
    private readonly issuers: IssuersService,
    private readonly params: ArcaParamsService,
    private readonly paramCache: ArcaParamCacheService,
    private readonly arcaHealth: ArcaHealthService,
  ) {}

  @Get(":id/params/:paramType")
  async paramTable(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Param("paramType", new ZodValidationPipe(arcaParamTypeSchema))
    paramType: ArcaParamTypeName,
  ): Promise<ArcaParam[]> {
    const issuer = await this.issuers.getFromUser(id, user.sub);
    return await this.paramCache.get(issuer, paramType);
  }

  @Get(":id/arca-health")
  async arcaHealthCheck(@CurrentUser() user: JwtPayload, @Param("id") id: string): Promise<ArcaHealth> {
    const issuer = await this.issuers.getFromUser(id, user.sub);
    return await this.arcaHealth.check(issuer.environment);
  }

  @Get(":id/currencies")
  async currencies(@CurrentUser() user: JwtPayload, @Param("id") id: string): Promise<CurrencyInfo[]> {
    const issuer = await this.issuers.getFromUser(id, user.sub);
    return await this.params.getCurrencies(issuer);
  }

  @Get(":id/exchange-rate/:currencyId")
  async exchangeRate(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Param("currencyId") currencyId: string,
  ): Promise<ExchangeRateInfo> {
    const issuer = await this.issuers.getFromUser(id, user.sub);
    return await this.params.getExchangeRate(issuer, currencyId);
  }

  @Get(":id/fiscal-condition")
  async fiscalCondition(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
  ): Promise<{ fiscalCondition: FiscalConditionType | null }> {
    const issuer = await this.issuers.getFromUser(id, user.sub);
    return await this.params.detectFiscalCondition(issuer);
  }
}
