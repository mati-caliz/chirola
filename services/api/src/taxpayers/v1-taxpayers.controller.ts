import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ServiceAuthGuard } from '../service-auth/service-auth.guard';
import { RateLimitGuard } from '../service-auth/rate-limit.guard';
import { ServiceAuditInterceptor } from '../service-auth/service-audit.interceptor';
import { CurrentApiClient } from '../service-auth/current-api-client.decorator';
import { ApiClientService } from '../service-auth/api-client.service';
import type { AuthenticatedApiClient } from '../service-auth/api-client.service';
import { IssuersService } from '../issuers/issuers.service';
import { TaxpayersService } from './taxpayers.service';

@Controller('v1/taxpayers')
@UseGuards(ServiceAuthGuard, RateLimitGuard)
@UseInterceptors(ServiceAuditInterceptor)
export class V1TaxpayersController {
  constructor(
    private readonly taxpayers: TaxpayersService,
    private readonly issuers: IssuersService,
    private readonly apiClients: ApiClientService,
  ) {}

  @Get(':cuit')
  async lookup(
    @CurrentApiClient() apiClient: AuthenticatedApiClient,
    @Query('issuerId') issuerId: string,
    @Param('cuit') cuit: string,
  ) {
    await this.apiClients.assertIssuerGranted(apiClient.id, issuerId);
    const issuer = await this.issuers.getById(issuerId);
    return this.taxpayers.lookup(issuer, cuit);
  }
}
