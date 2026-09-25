import { Body, Controller, Get, Param, Patch, Post, Put, UseGuards } from "@nestjs/common";
import {
  arcaParamTypeSchema,
  type ArcaParamTypeName,
  uploadCertificateSchema,
  createIssuerSchema,
  paymentAccountSchema,
  type PaymentAccount,
  commercialAddressSchema,
  type CommercialAddress,
  matchCertificateSchema,
  generateCsrSchema,
  representativeSchema,
  type UploadCertificate,
  type CreateIssuer,
  type MatchCertificate,
  type GenerateCsr,
  type Representative,
} from "@chirola/shared";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import type { JwtPayload } from "../auth/auth.service";
import { IssuersService } from "./issuers.service";
import { CertsService } from "../certs/certs.service";
import { ArcaParamsService } from "./arca-params.service";
import { ArcaParamCacheService } from "./arca-param-cache.service";
import { ArcaHealthService } from "./arca-health.service";

@Controller("issuers")
@UseGuards(JwtAuthGuard)
export class IssuersController {
  constructor(
    private readonly issuers: IssuersService,
    private readonly certs: CertsService,
    private readonly params: ArcaParamsService,
    private readonly paramCache: ArcaParamCacheService,
    private readonly arcaHealth: ArcaHealthService,
  ) {}

  @Get(":id/params/:paramType")
  async paramTable(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Param("paramType", new ZodValidationPipe(arcaParamTypeSchema))
    paramType: ArcaParamTypeName,
  ) {
    const issuer = await this.issuers.getFromUser(id, user.sub);
    return this.paramCache.get(issuer, paramType);
  }

  @Get(":id/arca-health")
  async arcaHealthCheck(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    const issuer = await this.issuers.getFromUser(id, user.sub);
    return this.arcaHealth.check(issuer.environment);
  }

  @Get(":id/currencies")
  async currencies(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    const issuer = await this.issuers.getFromUser(id, user.sub);
    return this.params.getCurrencies(issuer);
  }

  @Get(":id/exchange-rate/:currencyId")
  async exchangeRate(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Param("currencyId") currencyId: string,
  ) {
    const issuer = await this.issuers.getFromUser(id, user.sub);
    return this.params.getExchangeRate(issuer, currencyId);
  }

  @Get(":id/fiscal-condition")
  async fiscalCondition(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    const issuer = await this.issuers.getFromUser(id, user.sub);
    return this.params.detectFiscalCondition(issuer);
  }

  @Post()
  create(
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(createIssuerSchema)) body: CreateIssuer,
  ) {
    return this.issuers.create(user.sub, body);
  }

  @Patch(":id/payment-account")
  async updatePaymentAccount(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(paymentAccountSchema)) body: PaymentAccount,
  ) {
    const issuer = await this.issuers.getFromUser(id, user.sub);
    return this.issuers.updatePaymentAccount(issuer.id, body);
  }

  @Put(":id/commercial-address")
  async updateCommercialAddress(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(commercialAddressSchema)) body: CommercialAddress,
  ) {
    await this.issuers.getFromUser(id, user.sub);
    await this.issuers.updateCommercialAddress(id, body);
    return this.issuers.getWithCertificate(id);
  }

  @Get()
  list(@CurrentUser() user: JwtPayload) {
    return this.issuers.list(user.sub);
  }

  @Post(":id/csr")
  async generateCsr(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(generateCsrSchema)) body: GenerateCsr,
  ) {
    const issuer = await this.issuers.getFromUser(id, user.sub);
    return this.certs.generateCsr(id, issuer.cuit, issuer.legalName, body.alias, body.regenerate);
  }

  @Put(":id/certificate")
  async matchCertificate(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(matchCertificateSchema)) body: MatchCertificate,
  ) {
    await this.issuers.getFromUser(id, user.sub);
    await this.certs.matchCertificate(id, body.certPem);
    return { ok: true };
  }

  @Put(":id/representative")
  async updateRepresentative(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(representativeSchema)) body: Representative,
  ) {
    await this.issuers.getFromUser(id, user.sub);
    await this.issuers.updateRepresentative(id, body);
    return this.issuers.getWithCertificate(id);
  }

  @Post(":id/certificate")
  async uploadCertificate(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(uploadCertificateSchema))
    body: UploadCertificate,
  ) {
    await this.issuers.getFromUser(id, user.sub);
    await this.certs.saveCertificate(id, body.privateKeyPem, body.certPem, body.alias);
    return { ok: true };
  }
}
