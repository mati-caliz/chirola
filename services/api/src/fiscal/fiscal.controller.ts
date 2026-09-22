import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { fiscalPeriodQuerySchema, type FiscalPeriodQuery } from '@chirola/shared';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { JwtPayload } from '../auth/auth.service';
import { IssuersService } from '../issuers/issuers.service';
import { IvaPositionService } from './iva-position.service';
import { FiscalAlertsService } from './fiscal-alerts.service';
import { SalesBookService } from './sales-book.service';
import { renderSalesBookCsv, salesBookFileName } from './sales-book-csv';

@Controller('fiscal')
@UseGuards(JwtAuthGuard)
export class FiscalController {
  constructor(
    private readonly issuers: IssuersService,
    private readonly ivaPosition: IvaPositionService,
    private readonly alerts: FiscalAlertsService,
    private readonly salesBook: SalesBookService,
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

  @Get('sales-book')
  async salesBookMonthly(
    @CurrentUser() user: JwtPayload,
    @Query(new ZodValidationPipe(fiscalPeriodQuerySchema)) query: FiscalPeriodQuery,
  ) {
    await this.issuers.getFromUser(query.issuerId, user.sub);
    return this.salesBook.getMonthly(query.issuerId, query.year, query.month);
  }

  @Get('sales-book/csv')
  async salesBookCsv(
    @CurrentUser() user: JwtPayload,
    @Query(new ZodValidationPipe(fiscalPeriodQuerySchema)) query: FiscalPeriodQuery,
    @Res() res: Response,
  ) {
    await this.issuers.getFromUser(query.issuerId, user.sub);
    const book = await this.salesBook.getMonthly(query.issuerId, query.year, query.month);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${salesBookFileName(book)}"`);
    res.end(renderSalesBookCsv(book));
  }
}
