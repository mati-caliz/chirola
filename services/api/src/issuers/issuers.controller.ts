import { Body, Controller, Get, Param, Patch, Post, Put, UseGuards } from "@nestjs/common";
import type { Issuer } from "@prisma/client";
import {
  createIssuerSchema,
  paymentAccountSchema,
  type PaymentAccount,
  commercialAddressSchema,
  type CommercialAddress,
  representativeSchema,
  type CreateIssuer,
  type Representative,
} from "@chirola/shared";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import type { JwtPayload } from "../auth/auth.service";
import { IssuersService, type IssuerDetail, type IssuerWithCertificateSummary } from "./issuers.service";

@Controller("issuers")
@UseGuards(JwtAuthGuard)
export class IssuersController {
  constructor(private readonly issuers: IssuersService) {}

  @Post()
  create(
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(createIssuerSchema)) body: CreateIssuer,
  ): Promise<Issuer> {
    return this.issuers.create(user.sub, body);
  }

  @Patch(":id/payment-account")
  async updatePaymentAccount(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(paymentAccountSchema)) body: PaymentAccount,
  ): Promise<Issuer> {
    return await this.issuers.updatePaymentAccount({ userId: user.sub }, id, body);
  }

  @Put(":id/commercial-address")
  async updateCommercialAddress(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(commercialAddressSchema)) body: CommercialAddress,
  ): Promise<IssuerDetail> {
    const owner = { userId: user.sub };
    await this.issuers.updateCommercialAddress(owner, id, body);
    return await this.issuers.getWithCertificate(owner, id);
  }

  @Get()
  list(@CurrentUser() user: JwtPayload): Promise<IssuerWithCertificateSummary[]> {
    return this.issuers.list(user.sub);
  }

  @Put(":id/representative")
  async updateRepresentative(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(representativeSchema)) body: Representative,
  ): Promise<IssuerDetail> {
    const owner = { userId: user.sub };
    await this.issuers.updateRepresentative(owner, id, body);
    return await this.issuers.getWithCertificate(owner, id);
  }
}
