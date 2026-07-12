import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { JwtPayload } from '../auth/auth.service';
import { IssuersService } from '../issuers/issuers.service';
import { IvaPositionService } from './iva-position.service';
import { FiscalAlertsService } from './fiscal-alerts.service';

@Controller('fiscal')
@UseGuards(JwtAuthGuard)
export class FiscalController {
  constructor(
    private readonly issuers: IssuersService,
    private readonly ivaPosition: IvaPositionService,
    private readonly alerts: FiscalAlertsService,
  ) {}

  @Get('iva-position')
  async ivaPositionMonthly(
    @CurrentUser() user: JwtPayload,
    @Query('issuerId') issuerId: string,
    @Query('year') year: string,
    @Query('month') month: string,
  ) {
    await this.issuers.getFromUser(issuerId, user.sub);
    return this.ivaPosition.getMonthlyPosition(issuerId, Number(year), Number(month));
  }

  @Get('vencimientos')
  async vencimientos(
    @CurrentUser() user: JwtPayload,
    @Query('issuerId') issuerId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const issuer = await this.issuers.getFromUser(issuerId, user.sub);
    return this.alerts.getVencimientos(
      issuer.cuit,
      from ? new Date(from) : undefined,
      to ? new Date(to) : undefined,
    );
  }

  @Get('alerts')
  async fiscalAlerts(
    @CurrentUser() user: JwtPayload,
    @Query('issuerId') issuerId: string,
  ) {
    const issuer = await this.issuers.getFromUser(issuerId, user.sub);
    return this.alerts.getAlerts(issuer);
  }
}
