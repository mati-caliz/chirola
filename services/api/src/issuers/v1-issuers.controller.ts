import { Body, Controller, Get, Param, Post, Put, UseGuards, UseInterceptors } from "@nestjs/common";
import {
  commercialAddressSchema,
  createIssuerSchema,
  generateCsrSchema,
  matchCertificateSchema,
  representativeSchema,
  type CommercialAddress,
  type CreateIssuer,
  type GenerateCsr,
  type MatchCertificate,
  type Representative,
} from "@chirola/shared";
import type { Issuer } from "@prisma/client";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { ServiceAuthGuard } from "../service-auth/service-auth.guard";
import { RateLimitGuard } from "../service-auth/rate-limit.guard";
import { ServiceAuditInterceptor } from "../service-auth/service-audit.interceptor";
import { CurrentApiClient } from "../service-auth/current-api-client.decorator";
import { ApiClientService, type AuthenticatedApiClient } from "../service-auth/api-client.service";
import { CertsService } from "../certs/certs.service";
import { SalesPointsService } from "./sales-points.service";
import { IssuersService, type IssuerDetail, type IssuerWithCertificateSummary } from "./issuers.service";

@Controller("v1/issuers")
@UseGuards(ServiceAuthGuard, RateLimitGuard)
@UseInterceptors(ServiceAuditInterceptor)
export class V1IssuersController {
  constructor(
    private readonly issuers: IssuersService,
    private readonly certs: CertsService,
    private readonly apiClients: ApiClientService,
    private readonly salesPoints: SalesPointsService,
  ) {}

  @Post()
  create(
    @CurrentApiClient() apiClient: AuthenticatedApiClient,
    @Body(new ZodValidationPipe(createIssuerSchema)) body: CreateIssuer,
  ): Promise<Issuer> {
    return this.issuers.createForApiClient(apiClient.id, body);
  }

  @Get()
  list(@CurrentApiClient() apiClient: AuthenticatedApiClient): Promise<IssuerWithCertificateSummary[]> {
    return this.issuers.listForApiClient(apiClient.id);
  }

  @Get(":id")
  async get(
    @CurrentApiClient() apiClient: AuthenticatedApiClient,
    @Param("id") id: string,
  ): Promise<IssuerDetail> {
    return await this.issuers.getWithCertificate({ apiClientId: apiClient.id }, id);
  }

  @Get(":id/sales-points")
  async listSalesPoints(
    @CurrentApiClient() apiClient: AuthenticatedApiClient,
    @Param("id") id: string,
  ): Promise<{ number: number; id: string; description: string | null }[]> {
    await this.apiClients.assertIssuerGranted(apiClient.id, id);
    return await this.salesPoints.listForIssuer(id);
  }

  @Put(":id/representative")
  async updateRepresentative(
    @CurrentApiClient() apiClient: AuthenticatedApiClient,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(representativeSchema)) body: Representative,
  ): Promise<IssuerDetail> {
    const owner = { apiClientId: apiClient.id };
    await this.issuers.updateRepresentative(owner, id, body);
    return await this.issuers.getWithCertificate(owner, id);
  }

  @Put(":id/commercial-address")
  async updateCommercialAddress(
    @CurrentApiClient() apiClient: AuthenticatedApiClient,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(commercialAddressSchema)) body: CommercialAddress,
  ): Promise<IssuerDetail> {
    const owner = { apiClientId: apiClient.id };
    await this.issuers.updateCommercialAddress(owner, id, body);
    return await this.issuers.getWithCertificate(owner, id);
  }

  @Post(":id/csr")
  async generateCsr(
    @CurrentApiClient() apiClient: AuthenticatedApiClient,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(generateCsrSchema)) body: GenerateCsr,
  ): Promise<{ csrPem: string }> {
    const issuer = await this.issuers.getOwned({ apiClientId: apiClient.id }, id);
    return await this.certs.generateCsr(id, issuer, body);
  }

  @Put(":id/certificate")
  async matchCertificate(
    @CurrentApiClient() apiClient: AuthenticatedApiClient,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(matchCertificateSchema)) body: MatchCertificate,
  ): Promise<IssuerDetail> {
    await this.apiClients.assertIssuerGranted(apiClient.id, id);
    await this.certs.matchCertificate(id, body.certPem);
    return await this.issuers.getWithCertificate({ apiClientId: apiClient.id }, id);
  }
}
