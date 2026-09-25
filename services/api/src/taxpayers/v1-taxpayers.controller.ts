import { Controller, Get, Param, Query, UseGuards, UseInterceptors } from "@nestjs/common";
import { ServiceAuthGuard } from "../service-auth/service-auth.guard";
import { RateLimitGuard } from "../service-auth/rate-limit.guard";
import { ServiceAuditInterceptor } from "../service-auth/service-audit.interceptor";
import { CurrentApiClient } from "../service-auth/current-api-client.decorator";
import type { AuthenticatedApiClient } from "../service-auth/api-client.service";
import { IssuersService } from "../issuers/issuers.service";
import { TaxpayersService } from "./taxpayers.service";
import { TaxpayerInfo } from "@chirola/shared";

@Controller("v1/taxpayers")
@UseGuards(ServiceAuthGuard, RateLimitGuard)
@UseInterceptors(ServiceAuditInterceptor)
export class V1TaxpayersController {
  constructor(
    private readonly taxpayers: TaxpayersService,
    private readonly issuers: IssuersService,
  ) {}

  @Get(":cuit")
  async lookup(
    @CurrentApiClient() apiClient: AuthenticatedApiClient,
    @Query("issuerId") issuerId: string,
    @Param("cuit") cuit: string,
  ): Promise<TaxpayerInfo> {
    const issuer = await this.issuers.getOwned({ apiClientId: apiClient.id }, issuerId);
    return await this.taxpayers.lookup(issuer, cuit);
  }
}
