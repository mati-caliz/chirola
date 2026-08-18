import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  createIssuerSchema,
  generateCsrSchema,
  matchCertificateSchema,
  type CreateIssuer,
  type GenerateCsr,
  type MatchCertificate,
} from '@chirola/shared';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { ServiceAuthGuard } from '../service-auth/service-auth.guard';
import { RateLimitGuard } from '../service-auth/rate-limit.guard';
import { ServiceAuditInterceptor } from '../service-auth/service-audit.interceptor';
import { CurrentApiClient } from '../service-auth/current-api-client.decorator';
import {
  ApiClientService,
  type AuthenticatedApiClient,
} from '../service-auth/api-client.service';
import { CertsService } from '../certs/certs.service';
import { SalesPointsService } from './sales-points.service';
import { IssuersService } from './issuers.service';

@Controller('v1/issuers')
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
  ) {
    return this.issuers.createForApiClient(apiClient.id, body);
  }

  @Get()
  list(@CurrentApiClient() apiClient: AuthenticatedApiClient) {
    return this.issuers.listForApiClient(apiClient.id);
  }

  @Get(':id')
  async get(
    @CurrentApiClient() apiClient: AuthenticatedApiClient,
    @Param('id') id: string,
  ) {
    await this.apiClients.assertIssuerGranted(apiClient.id, id);
    return this.issuers.getWithCertificate(id);
  }

  @Get(':id/sales-points')
  async listSalesPoints(
    @CurrentApiClient() apiClient: AuthenticatedApiClient,
    @Param('id') id: string,
  ) {
    await this.apiClients.assertIssuerGranted(apiClient.id, id);
    return this.salesPoints.listForIssuer(id);
  }

  @Post(':id/csr')
  async generateCsr(
    @CurrentApiClient() apiClient: AuthenticatedApiClient,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(generateCsrSchema)) body: GenerateCsr,
  ) {
    await this.apiClients.assertIssuerGranted(apiClient.id, id);
    const issuer = await this.issuers.getById(id);
    return this.certs.generateCsr(
      id,
      issuer.cuit,
      issuer.legalName,
      body.alias,
      body.regenerate,
    );
  }

  @Put(':id/certificate')
  async matchCertificate(
    @CurrentApiClient() apiClient: AuthenticatedApiClient,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(matchCertificateSchema)) body: MatchCertificate,
  ) {
    await this.apiClients.assertIssuerGranted(apiClient.id, id);
    await this.certs.matchCertificate(id, body.certPem);
    return this.issuers.getWithCertificate(id);
  }
}
