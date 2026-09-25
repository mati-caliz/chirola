import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import type { JwtPayload } from "../auth/auth.service";
import { IssuersService } from "../issuers/issuers.service";
import { TaxpayersService } from "./taxpayers.service";
import { TaxpayerInfo } from "@chirola/shared";

@Controller("issuers/:issuerId/taxpayers")
@UseGuards(JwtAuthGuard)
export class TaxpayersController {
  constructor(
    private readonly taxpayers: TaxpayersService,
    private readonly issuers: IssuersService,
  ) {}

  @Get(":cuit")
  async lookup(
    @CurrentUser() user: JwtPayload,
    @Param("issuerId") issuerId: string,
    @Param("cuit") cuit: string,
  ): Promise<TaxpayerInfo> {
    const issuer = await this.issuers.getFromUser(issuerId, user.sub);
    return await this.taxpayers.lookup(issuer, cuit);
  }
}
