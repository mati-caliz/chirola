import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Res,
  UseGuards,
} from "@nestjs/common";
import type { Response } from "express";
import {
  DraftAmounts,
  draftAmountsSchema,
  EmissionPlan,
  issueVoucherSchema,
  type DraftAmountsInput,
  type IssueVoucher,
} from "@chirola/shared";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import type { JwtPayload } from "../auth/auth.service";
import { VouchersService, type IssuedVoucher } from "./vouchers.service";
import { CreditNoteDraftService } from "./credit-note-draft.service";
import { DraftAmountsService } from "./draft-amounts.service";
import { VoucherAmounts } from "../arca/wsfe/wsfe.types";
import type { VoucherDetail } from "./voucher-tables";

@Controller("vouchers")
@UseGuards(JwtAuthGuard)
export class VouchersController {
  constructor(
    private readonly vouchers: VouchersService,
    private readonly creditNoteDrafts: CreditNoteDraftService,
    private readonly draftAmounts: DraftAmountsService,
  ) {}

  @Post()
  issue(
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(issueVoucherSchema))
    body: IssueVoucher,
    @Headers("idempotency-key") idempotencyKey?: string,
  ): Promise<IssuedVoucher> {
    return this.vouchers.issue(user.sub, body, idempotencyKey);
  }

  @Post("preview")
  preview(
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(issueVoucherSchema)) body: IssueVoucher,
  ): Promise<VoucherAmounts> {
    return this.vouchers.previewForUser(user.sub, body);
  }

  @Post("amounts")
  @HttpCode(HttpStatus.OK)
  amounts(@Body(new ZodValidationPipe(draftAmountsSchema)) body: DraftAmountsInput): DraftAmounts {
    return this.draftAmounts.calculate(body);
  }

  @Post("dry-run")
  dryRun(
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(issueVoucherSchema)) body: IssueVoucher,
  ): Promise<EmissionPlan> {
    return this.vouchers.computeEmissionPlanForUser(user.sub, body);
  }

  @Get(":id")
  get(@CurrentUser() user: JwtPayload, @Param("id") id: string): Promise<VoucherDetail> {
    return this.vouchers.get(user.sub, id);
  }

  @Get(":id/credit-note-draft")
  creditNoteDraft(@CurrentUser() user: JwtPayload, @Param("id") id: string): Promise<IssueVoucher> {
    return this.creditNoteDrafts.draftForUser(user.sub, id);
  }

  @Get(":id/qr.png")
  async qr(@CurrentUser() user: JwtPayload, @Param("id") id: string, @Res() res: Response): Promise<void> {
    const png = await this.vouchers.buildQrPngBuffer(user.sub, id);
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "private, max-age=86400");
    res.end(png);
  }

  @Get(":id/pdf")
  async pdf(@CurrentUser() user: JwtPayload, @Param("id") id: string, @Res() res: Response): Promise<void> {
    const pdf = await this.vouchers.renderPdf(user.sub, id);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="voucher-${id}.pdf"`);
    res.end(pdf);
  }
}
