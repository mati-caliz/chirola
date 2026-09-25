import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from "@nestjs/common";
import {
  importPurchaseInvoicesSchema,
  purchaseInvoiceSchema,
  updatePurchaseInvoiceSchema,
  type ImportPurchaseInvoicesInput,
  type PurchaseInvoiceInput,
  type UpdatePurchaseInvoiceInput,
} from "@chirola/shared";
import type { PurchaseInvoice } from "@prisma/client";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { parseOptionalNumber } from "../common/query-params";
import { ServiceAuthGuard } from "../service-auth/service-auth.guard";
import { RateLimitGuard } from "../service-auth/rate-limit.guard";
import { CurrentApiClient } from "../service-auth/current-api-client.decorator";
import { ApiClientService, type AuthenticatedApiClient } from "../service-auth/api-client.service";
import { PurchaseInvoicesService, type PurchaseInvoiceListing } from "./purchase-invoices.service";
import { ImportPreview, PurchaseImportService } from "./purchase-import.service";

@Controller("v1/purchase-invoices")
@UseGuards(ServiceAuthGuard, RateLimitGuard)
export class V1PurchaseInvoicesController {
  constructor(
    private readonly purchaseInvoices: PurchaseInvoicesService,
    private readonly purchaseImport: PurchaseImportService,
    private readonly apiClients: ApiClientService,
  ) {}

  @Post("import/preview")
  async previewImport(
    @CurrentApiClient() apiClient: AuthenticatedApiClient,
    @Body(new ZodValidationPipe(importPurchaseInvoicesSchema))
    body: ImportPurchaseInvoicesInput,
  ): Promise<ImportPreview> {
    await this.apiClients.assertIssuerGranted(apiClient.id, body.issuerId);
    return await this.purchaseImport.preview(body.issuerId, body.csv);
  }

  @Post("import")
  async import(
    @CurrentApiClient() apiClient: AuthenticatedApiClient,
    @Body(new ZodValidationPipe(importPurchaseInvoicesSchema))
    body: ImportPurchaseInvoicesInput,
  ): Promise<ImportPreview> {
    await this.apiClients.assertIssuerGranted(apiClient.id, body.issuerId);
    return await this.purchaseImport.import(body.issuerId, body.csv);
  }

  @Post()
  async create(
    @CurrentApiClient() apiClient: AuthenticatedApiClient,
    @Body(new ZodValidationPipe(purchaseInvoiceSchema)) body: PurchaseInvoiceInput,
  ): Promise<PurchaseInvoice> {
    await this.apiClients.assertIssuerGranted(apiClient.id, body.issuerId);
    return await this.purchaseInvoices.create(body.issuerId, body);
  }

  @Get()
  async list(
    @CurrentApiClient() apiClient: AuthenticatedApiClient,
    @Query("issuerId") issuerId: string,
    @Query("year") year?: string,
    @Query("month") month?: string,
  ): Promise<PurchaseInvoiceListing> {
    await this.apiClients.assertIssuerGranted(apiClient.id, issuerId);
    return await this.purchaseInvoices.list(issuerId, parseOptionalNumber(year), parseOptionalNumber(month));
  }

  @Put(":id")
  async update(
    @CurrentApiClient() apiClient: AuthenticatedApiClient,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updatePurchaseInvoiceSchema))
    body: UpdatePurchaseInvoiceInput,
  ): Promise<PurchaseInvoice> {
    await this.apiClients.assertIssuerGranted(apiClient.id, body.issuerId);
    return await this.purchaseInvoices.update(body.issuerId, id, body);
  }

  @Delete(":id")
  async remove(
    @CurrentApiClient() apiClient: AuthenticatedApiClient,
    @Param("id") id: string,
    @Query("issuerId") issuerId: string,
  ): Promise<{ ok: boolean }> {
    await this.apiClients.assertIssuerGranted(apiClient.id, issuerId);
    return await this.purchaseInvoices.remove(issuerId, id);
  }
}
