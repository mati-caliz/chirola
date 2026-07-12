import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ServiceAuthGuard } from '../service-auth/service-auth.guard';
import { CurrentApiClient } from '../service-auth/current-api-client.decorator';
import { ApiClientService } from '../service-auth/api-client.service';
import type { AuthenticatedApiClient } from '../service-auth/api-client.service';
import { RateLimitGuard } from '../service-auth/rate-limit.guard';
import { IssuersService } from './issuers.service';
import { ArcaParamsService } from './arca-params.service';

@Controller('v1')
@UseGuards(ServiceAuthGuard, RateLimitGuard)
export class V1ParamsController {
  constructor(
    private readonly issuers: IssuersService,
    private readonly params: ArcaParamsService,
    private readonly apiClients: ApiClientService,
  ) {}

  @Get('sales-points')
  async salesPoints(
    @CurrentApiClient() apiClient: AuthenticatedApiClient,
    @Query('issuerId') issuerId: string,
  ) {
    const issuer = await this.resolve(apiClient, issuerId);
    return this.params.getSalesPoints(issuer);
  }

  @Get('fiscal-condition')
  async fiscalCondition(
    @CurrentApiClient() apiClient: AuthenticatedApiClient,
    @Query('issuerId') issuerId: string,
  ) {
    const issuer = await this.resolve(apiClient, issuerId);
    return this.params.detectFiscalCondition(issuer);
  }

  private async resolve(apiClient: AuthenticatedApiClient, issuerId: string) {
    await this.apiClients.assertIssuerGranted(apiClient.id, issuerId);
    return this.issuers.getById(issuerId);
  }
}
