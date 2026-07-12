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
  purchaseInvoiceSchema,
  updatePurchaseInvoiceSchema,
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

@Controller('v1/purchase-invoices')
@UseGuards(ServiceAuthGuard, RateLimitGuard)
export class V1PurchaseInvoicesController {
  constructor(
    private readonly purchaseInvoices: PurchaseInvoicesService,
    private readonly apiClients: ApiClientService,
  ) {}

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
