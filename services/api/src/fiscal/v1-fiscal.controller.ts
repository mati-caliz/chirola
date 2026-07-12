import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ServiceAuthGuard } from '../service-auth/service-auth.guard';
import { RateLimitGuard } from '../service-auth/rate-limit.guard';
import { CurrentApiClient } from '../service-auth/current-api-client.decorator';
import {
  ApiClientService,
  type AuthenticatedApiClient,
} from '../service-auth/api-client.service';
import { IssuersService } from '../issuers/issuers.service';
import { IvaPositionService } from './iva-position.service';
import { FiscalAlertsService } from './fiscal-alerts.service';

@Controller('v1/fiscal')
@UseGuards(ServiceAuthGuard, RateLimitGuard)
export class V1FiscalController {
  constructor(
    private readonly apiClients: ApiClientService,
    private readonly issuers: IssuersService,
    private readonly ivaPosition: IvaPositionService,
    private readonly alerts: FiscalAlertsService,
  ) {}

  @Get('iva-position')
  async ivaPositionMonthly(
    @CurrentApiClient() apiClient: AuthenticatedApiClient,
    @Query('issuerId') issuerId: string,
    @Query('year') year: string,
    @Query('month') month: string,
  ) {
    await this.apiClients.assertIssuerGranted(apiClient.id, issuerId);
    return this.ivaPosition.getMonthlyPosition(issuerId, Number(year), Number(month));
  }

  @Get('vencimientos')
  async vencimientos(
    @CurrentApiClient() apiClient: AuthenticatedApiClient,
    @Query('issuerId') issuerId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    await this.apiClients.assertIssuerGranted(apiClient.id, issuerId);
    const issuer = await this.issuers.getById(issuerId);
    return this.alerts.getVencimientos(
      issuer.cuit,
      from ? new Date(from) : undefined,
      to ? new Date(to) : undefined,
    );
  }

  @Get('alerts')
  async fiscalAlerts(
    @CurrentApiClient() apiClient: AuthenticatedApiClient,
    @Query('issuerId') issuerId: string,
  ) {
    await this.apiClients.assertIssuerGranted(apiClient.id, issuerId);
    const issuer = await this.issuers.getById(issuerId);
    return this.alerts.getAlerts(issuer);
  }
}
