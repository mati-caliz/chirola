import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  importPurchaseInvoicesSchema,
  purchaseInvoiceSchema,
  updatePurchaseInvoiceSchema,
  type ImportPurchaseInvoicesInput,
  type PurchaseInvoiceInput,
  type UpdatePurchaseInvoiceInput,
} from '@chirola/shared';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { ServiceAuthGuard } from '../service-auth/service-auth.guard';
import { RateLimitGuard } from '../service-auth/rate-limit.guard';
import { CurrentApiClient } from '../service-auth/current-api-client.decorator';
import {
  ApiClientService,
  type AuthenticatedApiClient,
} from '../service-auth/api-client.service';
import { PurchaseInvoicesService } from './purchase-invoices.service';
import { PurchaseImportService } from './purchase-import.service';

@Controller('v1/purchase-invoices')
@UseGuards(ServiceAuthGuard, RateLimitGuard)
export class V1PurchaseInvoicesController {
  constructor(
    private readonly purchaseInvoices: PurchaseInvoicesService,
    private readonly purchaseImport: PurchaseImportService,
    private readonly apiClients: ApiClientService,
  ) {}

  @Post('import/preview')
  async previewImport(
    @CurrentApiClient() apiClient: AuthenticatedApiClient,
    @Body(new ZodValidationPipe(importPurchaseInvoicesSchema))
    body: ImportPurchaseInvoicesInput,
  ) {
    await this.apiClients.assertIssuerGranted(apiClient.id, body.issuerId);
    return this.purchaseImport.preview(body.issuerId, body.csv);
  }

  @Post('import')
  async import(
    @CurrentApiClient() apiClient: AuthenticatedApiClient,
    @Body(new ZodValidationPipe(importPurchaseInvoicesSchema))
    body: ImportPurchaseInvoicesInput,
  ) {
    await this.apiClients.assertIssuerGranted(apiClient.id, body.issuerId);
    return this.purchaseImport.import(body.issuerId, body.csv);
  }

  @Post()
  async create(
    @CurrentApiClient() apiClient: AuthenticatedApiClient,
    @Body(new ZodValidationPipe(purchaseInvoiceSchema)) body: PurchaseInvoiceInput,
  ) {
    await this.apiClients.assertIssuerGranted(apiClient.id, body.issuerId);
    return this.purchaseInvoices.create(body.issuerId, body);
  }

  @Get()
  async list(
    @CurrentApiClient() apiClient: AuthenticatedApiClient,
    @Query('issuerId') issuerId: string,
    @Query('year') year?: string,
    @Query('month') month?: string,
  ) {
    await this.apiClients.assertIssuerGranted(apiClient.id, issuerId);
    return this.purchaseInvoices.list(
      issuerId,
      year ? Number(year) : undefined,
      month ? Number(month) : undefined,
    );
  }

  @Put(':id')
  async update(
    @CurrentApiClient() apiClient: AuthenticatedApiClient,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updatePurchaseInvoiceSchema))
    body: UpdatePurchaseInvoiceInput,
  ) {
    await this.apiClients.assertIssuerGranted(apiClient.id, body.issuerId);
    return this.purchaseInvoices.update(body.issuerId, id, body);
  }

  @Delete(':id')
  async remove(
    @CurrentApiClient() apiClient: AuthenticatedApiClient,
    @Param('id') id: string,
    @Query('issuerId') issuerId: string,
  ) {
    await this.apiClients.assertIssuerGranted(apiClient.id, issuerId);
    return this.purchaseInvoices.remove(issuerId, id);
  }
}
