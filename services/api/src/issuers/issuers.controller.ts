import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  arcaParamTypeSchema,
  type ArcaParamTypeName,
  uploadCertificateSchema,
  createIssuerSchema,
  paymentAccountSchema,
  type PaymentAccount,
  matchCertificateSchema,
  generateCsrSchema,
  type UploadCertificate,
  type CreateIssuer,
  type MatchCertificate,
  type GenerateCsr,
} from '@chirola/shared';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { JwtPayload } from '../auth/auth.service';
import { IssuersService } from './issuers.service';
import { CertsService } from '../certs/certs.service';
import { ArcaParamsService } from './arca-params.service';
import { ArcaParamCacheService } from './arca-param-cache.service';

@Controller('issuers')
@UseGuards(JwtAuthGuard)
export class IssuersController {
  constructor(
    private readonly issuers: IssuersService,
    private readonly certs: CertsService,
    private readonly params: ArcaParamsService,
    private readonly paramCache: ArcaParamCacheService,
  ) {}

  @Get(':id/sales-points')
  async salesPoints(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    const issuer = await this.issuers.getFromUser(id, user.sub);
    return this.params.getSalesPoints(issuer);
  }

  @Get(':id/params/:paramType')
  async paramTable(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Param('paramType', new ZodValidationPipe(arcaParamTypeSchema))
    paramType: ArcaParamTypeName,
  ) {
    const issuer = await this.issuers.getFromUser(id, user.sub);
    return this.paramCache.get(issuer, paramType);
  }

  @Get(':id/currencies')
  async currencies(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    const issuer = await this.issuers.getFromUser(id, user.sub);
    return this.params.getCurrencies(issuer);
  }

  @Get(':id/exchange-rate/:currencyId')
  async exchangeRate(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Param('currencyId') currencyId: string,
  ) {
    const issuer = await this.issuers.getFromUser(id, user.sub);
    return this.params.getExchangeRate(issuer, currencyId);
  }

  @Get(':id/fiscal-condition')
  async fiscalCondition(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
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

  @Patch(':id/payment-account')
  async updatePaymentAccount(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(paymentAccountSchema)) body: PaymentAccount,
  ) {
    const issuer = await this.issuers.getFromUser(id, user.sub);
    return this.issuers.updatePaymentAccount(issuer.id, body);
  }

  @Get()
  list(@CurrentUser() user: JwtPayload) {
    return this.issuers.list(user.sub);
  }

  @Post(':id/csr')
  async generateCsr(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(generateCsrSchema)) body: GenerateCsr,
  ) {
    const issuer = await this.issuers.getFromUser(id, user.sub);
    return this.certs.generateCsr(
      id,
      issuer.cuit,
      issuer.legalName,
      body.alias,
    );
  }

  @Put(':id/certificate')
  async matchCertificate(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(matchCertificateSchema)) body: MatchCertificate,
  ) {
    await this.issuers.getFromUser(id, user.sub);
    await this.certs.matchCertificate(id, body.certPem);
    return { ok: true };
  }

  @Post(':id/certificate')
  async uploadCertificate(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(uploadCertificateSchema))
    body: UploadCertificate,
  ) {
    await this.issuers.getFromUser(id, user.sub);
    await this.certs.saveCertificate(
      id,
      body.privateKeyPem,
      body.certPem,
      body.alias,
    );
    return { ok: true };
  }
}
