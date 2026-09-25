import { Controller, Get, Query, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { fiscalPeriodQuerySchema, SalesBook, type FiscalPeriodQuery } from "@chirola/shared";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { ServiceAuthGuard } from "../service-auth/service-auth.guard";
import { RateLimitGuard } from "../service-auth/rate-limit.guard";
import { CurrentApiClient } from "../service-auth/current-api-client.decorator";
import { ApiClientService, type AuthenticatedApiClient } from "../service-auth/api-client.service";
import { SalesBookService } from "./sales-book.service";
import { renderSalesBookCsv, salesBookFileName } from "./sales-book-csv";

@Controller("v1/fiscal")
@UseGuards(ServiceAuthGuard, RateLimitGuard)
export class V1SalesBookController {
  constructor(
    private readonly apiClients: ApiClientService,
    private readonly salesBook: SalesBookService,
  ) {}

  @Get("sales-book")
  async salesBookMonthly(
    @CurrentApiClient() apiClient: AuthenticatedApiClient,
    @Query(new ZodValidationPipe(fiscalPeriodQuerySchema)) query: FiscalPeriodQuery,
  ): Promise<SalesBook> {
    await this.apiClients.assertIssuerGranted(apiClient.id, query.issuerId);
    return await this.salesBook.getMonthly(query.issuerId, query.year, query.month);
  }

  @Get("sales-book/csv")
  async salesBookCsv(
    @CurrentApiClient() apiClient: AuthenticatedApiClient,
    @Query(new ZodValidationPipe(fiscalPeriodQuerySchema)) query: FiscalPeriodQuery,
    @Res() res: Response,
  ): Promise<void> {
    await this.apiClients.assertIssuerGranted(apiClient.id, query.issuerId);
    const book = await this.salesBook.getMonthly(query.issuerId, query.year, query.month);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${salesBookFileName(book)}"`);
    res.end(renderSalesBookCsv(book));
  }
}
