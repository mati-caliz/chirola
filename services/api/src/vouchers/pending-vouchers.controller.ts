import { Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import type { JwtPayload } from "../auth/auth.service";
import { PendingVouchersService } from "./pending-vouchers.service";
import { PendingVoucherSummary } from "@chirola/shared";

@Controller("issuers/:issuerId/pending-vouchers")
@UseGuards(JwtAuthGuard)
export class PendingVouchersController {
  constructor(private readonly pendingVouchers: PendingVouchersService) {}

  @Get()
  list(
    @CurrentUser() user: JwtPayload,
    @Param("issuerId") issuerId: string,
  ): Promise<PendingVoucherSummary[]> {
    return this.pendingVouchers.listForUser(user.sub, issuerId);
  }

  @Post(":id/retry")
  @HttpCode(HttpStatus.NO_CONTENT)
  retry(
    @CurrentUser() user: JwtPayload,
    @Param("issuerId") issuerId: string,
    @Param("id") id: string,
  ): Promise<void> {
    return this.pendingVouchers.retryForUser(user.sub, issuerId, id);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  discard(
    @CurrentUser() user: JwtPayload,
    @Param("issuerId") issuerId: string,
    @Param("id") id: string,
  ): Promise<void> {
    return this.pendingVouchers.discardForUser(user.sub, issuerId, id);
  }
}
