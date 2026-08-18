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
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { JwtPayload } from '../auth/auth.service';
import { IssuersService } from '../issuers/issuers.service';
import { PurchaseInvoicesService } from './purchase-invoices.service';
import { PurchaseImportService } from './purchase-import.service';

@Controller('purchase-invoices')
@UseGuards(JwtAuthGuard)
export class PurchaseInvoicesController {
  constructor(
    private readonly purchaseInvoices: PurchaseInvoicesService,
    private readonly purchaseImport: PurchaseImportService,
    private readonly issuers: IssuersService,
  ) {}

  @Post('import/preview')
  async previewImport(
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(importPurchaseInvoicesSchema))
    body: ImportPurchaseInvoicesInput,
  ) {
    await this.issuers.getFromUser(body.issuerId, user.sub);
    return this.purchaseImport.preview(body.issuerId, body.csv);
  }

  @Post('import')
  async import(
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(importPurchaseInvoicesSchema))
    body: ImportPurchaseInvoicesInput,
  ) {
    await this.issuers.getFromUser(body.issuerId, user.sub);
    return this.purchaseImport.import(body.issuerId, body.csv);
  }

  @Post()
  async create(
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(purchaseInvoiceSchema)) body: PurchaseInvoiceInput,
  ) {
    await this.issuers.getFromUser(body.issuerId, user.sub);
    return this.purchaseInvoices.create(body.issuerId, body);
  }

  @Get()
  async list(
    @CurrentUser() user: JwtPayload,
    @Query('issuerId') issuerId: string,
    @Query('year') year?: string,
    @Query('month') month?: string,
  ) {
    await this.issuers.getFromUser(issuerId, user.sub);
    return this.purchaseInvoices.list(
      issuerId,
      year ? Number(year) : undefined,
      month ? Number(month) : undefined,
    );
  }

  @Put(':id')
  async update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updatePurchaseInvoiceSchema))
    body: UpdatePurchaseInvoiceInput,
  ) {
    await this.issuers.getFromUser(body.issuerId, user.sub);
    return this.purchaseInvoices.update(body.issuerId, id, body);
  }

  @Delete(':id')
  async remove(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Query('issuerId') issuerId: string,
  ) {
    await this.issuers.getFromUser(issuerId, user.sub);
    return this.purchaseInvoices.remove(issuerId, id);
  }
}
