import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import type { JwtPayload } from "../auth/auth.service";
import { VouchersService } from "./vouchers.service";
import type { VoucherListEntry } from "./voucher-tables";

@Controller("issuers/:issuerId/vouchers")
@UseGuards(JwtAuthGuard)
export class IssuerVouchersController {
  constructor(private readonly vouchers: VouchersService) {}

  @Get()
  list(@CurrentUser() user: JwtPayload, @Param("issuerId") issuerId: string): Promise<VoucherListEntry[]> {
    return this.vouchers.listByIssuer(user.sub, issuerId);
  }
}
