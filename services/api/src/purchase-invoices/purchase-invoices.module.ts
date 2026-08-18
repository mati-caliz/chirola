import { Module } from '@nestjs/common';
import { PurchaseInvoicesService } from './purchase-invoices.service';
import { PurchaseImportService } from './purchase-import.service';
import { PurchaseInvoicesController } from './purchase-invoices.controller';
import { V1PurchaseInvoicesController } from './v1-purchase-invoices.controller';
import { IssuersModule } from '../issuers/issuers.module';
import { ServiceAuthModule } from '../service-auth/service-auth.module';

@Module({
  imports: [IssuersModule, ServiceAuthModule],
  controllers: [PurchaseInvoicesController, V1PurchaseInvoicesController],
  providers: [PurchaseInvoicesService, PurchaseImportService],
  exports: [PurchaseInvoicesService],
})
export class PurchaseInvoicesModule {}
