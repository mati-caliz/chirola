import { Controller, Get, Query, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import {
  fiscalPeriodQuerySchema,
  SalesBook,
  type FiscalAlerts,
  type FiscalPeriodQuery,
  type IvaPosition,
  type Vencimiento,
} from "@chirola/shared";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { parseOptionalDate } from "../common/query-params";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import type { JwtPayload } from "../auth/auth.service";
import { IssuersService } from "../issuers/issuers.service";
import { IvaPositionService } from "./iva-position.service";
import { FiscalAlertsService } from "./fiscal-alerts.service";
import { SalesBookService } from "./sales-book.service";
import { renderSalesBookCsv, salesBookFileName } from "./sales-book-csv";

@Controller("fiscal")
@UseGuards(JwtAuthGuard)
export class FiscalController {
  constructor(
    private readonly issuers: IssuersService,
    private readonly ivaPosition: IvaPositionService,
    private readonly alerts: FiscalAlertsService,
    private readonly salesBook: SalesBookService,
  ) {}

  @Get("iva-position")
  async ivaPositionMonthly(
    @CurrentUser() user: JwtPayload,
    @Query("issuerId") issuerId: string,
    @Query("year") year: string,
    @Query("month") month: string,
  ): Promise<IvaPosition> {
    await this.issuers.getFromUser(issuerId, user.sub);
    return await this.ivaPosition.getMonthlyPosition(issuerId, Number(year), Number(month));
  }

  @Get("vencimientos")
  async vencimientos(
    @CurrentUser() user: JwtPayload,
    @Query("issuerId") issuerId: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ): Promise<Vencimiento[]> {
    const issuer = await this.issuers.getFromUser(issuerId, user.sub);
    return this.alerts.getVencimientos(issuer.cuit, parseOptionalDate(from), parseOptionalDate(to));
  }

  @Get("alerts")
  async fiscalAlerts(
    @CurrentUser() user: JwtPayload,
    @Query("issuerId") issuerId: string,
  ): Promise<FiscalAlerts> {
    const issuer = await this.issuers.getFromUser(issuerId, user.sub);
    return await this.alerts.getAlerts(issuer);
  }

  @Get("sales-book")
  async salesBookMonthly(
    @CurrentUser() user: JwtPayload,
    @Query(new ZodValidationPipe(fiscalPeriodQuerySchema)) query: FiscalPeriodQuery,
  ): Promise<SalesBook> {
    await this.issuers.getFromUser(query.issuerId, user.sub);
    return await this.salesBook.getMonthly(query.issuerId, query.year, query.month);
  }

  @Get("sales-book/csv")
  async salesBookCsv(
    @CurrentUser() user: JwtPayload,
    @Query(new ZodValidationPipe(fiscalPeriodQuerySchema)) query: FiscalPeriodQuery,
    @Res() res: Response,
  ): Promise<void> {
    await this.issuers.getFromUser(query.issuerId, user.sub);
    const book = await this.salesBook.getMonthly(query.issuerId, query.year, query.month);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${salesBookFileName(book)}"`);
    res.end(renderSalesBookCsv(book));
  }
}
