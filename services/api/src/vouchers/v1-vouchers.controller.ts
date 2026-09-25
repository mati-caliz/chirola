import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import type { Response } from "express";
import { EmissionPlan, issueVoucherSchema, type IssueVoucher } from "@chirola/shared";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { ServiceAuthGuard } from "../service-auth/service-auth.guard";
import { RateLimitGuard } from "../service-auth/rate-limit.guard";
import { ServiceAuditInterceptor } from "../service-auth/service-audit.interceptor";
import { CurrentApiClient } from "../service-auth/current-api-client.decorator";
import type { AuthenticatedApiClient } from "../service-auth/api-client.service";
import { VouchersService, type IssuedVoucher } from "./vouchers.service";
import { CreditNoteDraftService } from "./credit-note-draft.service";
import { VoucherAmounts } from "../arca/wsfe/wsfe.types";
import type { VoucherDetail, VoucherListEntry } from "./voucher-tables";

@Controller("v1/vouchers")
@UseGuards(ServiceAuthGuard, RateLimitGuard)
@UseInterceptors(ServiceAuditInterceptor)
export class V1VouchersController {
  constructor(
    private readonly vouchers: VouchersService,
    private readonly creditNoteDrafts: CreditNoteDraftService,
  ) {}

  @Post()
  issue(
    @CurrentApiClient() apiClient: AuthenticatedApiClient,
    @Body(new ZodValidationPipe(issueVoucherSchema)) body: IssueVoucher,
    @Headers("idempotency-key") idempotencyKey?: string,
  ): Promise<IssuedVoucher> {
    return this.vouchers.issueForApiClient(apiClient, body, idempotencyKey);
  }

  @Post("preview")
  preview(
    @CurrentApiClient() apiClient: AuthenticatedApiClient,
    @Body(new ZodValidationPipe(issueVoucherSchema)) body: IssueVoucher,
  ): Promise<VoucherAmounts> {
    return this.vouchers.previewForApiClient(apiClient, body);
  }

  @Post("dry-run")
  dryRun(
    @CurrentApiClient() apiClient: AuthenticatedApiClient,
    @Body(new ZodValidationPipe(issueVoucherSchema)) body: IssueVoucher,
  ): Promise<EmissionPlan> {
    return this.vouchers.computeEmissionPlanForApiClient(apiClient, body);
  }

  @Get()
  list(
    @CurrentApiClient() apiClient: AuthenticatedApiClient,
    @Query("issuerId") issuerId: string,
    @Query("limit") limit?: string,
  ): Promise<VoucherListEntry[]> {
    return this.vouchers.listForApiClient(
      apiClient,
      issuerId,
      limit === undefined ? undefined : Number(limit),
    );
  }

  @Get(":id/pdf")
  async pdf(
    @CurrentApiClient() apiClient: AuthenticatedApiClient,
    @Param("id") id: string,
    @Res() res: Response,
  ): Promise<void> {
    const pdf = await this.vouchers.renderPdfForApiClient(apiClient, id);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="voucher-${id}.pdf"`);
    res.end(pdf);
  }

  @Get(":id/credit-note-draft")
  creditNoteDraft(
    @CurrentApiClient() apiClient: AuthenticatedApiClient,
    @Param("id") id: string,
  ): Promise<IssueVoucher> {
    return this.creditNoteDrafts.draftForApiClient(apiClient, id);
  }

  @Get(":id")
  get(
    @CurrentApiClient() apiClient: AuthenticatedApiClient,
    @Param("id") id: string,
  ): Promise<VoucherDetail> {
    return this.vouchers.getForApiClient(apiClient, id);
  }
}
