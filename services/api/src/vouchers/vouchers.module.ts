import { Module } from '@nestjs/common';
import { VouchersService } from './vouchers.service';
import { VouchersController } from './vouchers.controller';
import { IssuerVouchersController } from './issuer-vouchers.controller';
import { V1VouchersController } from './v1-vouchers.controller';
import { IssuerLockService } from './issuer-lock.service';
import { VoucherRetryScheduler } from './voucher-retry.scheduler';
import { ReconciliationService } from './reconciliation.service';
import { ReconciliationController } from './reconciliation.controller';
import { ExportVouchersService } from './export-vouchers.service';
import { ExportVouchersController } from './export-vouchers.controller';
import { ArcaModule } from '../arca/arca.module';
import { CertsModule } from '../certs/certs.module';
import { IssuersModule } from '../issuers/issuers.module';
import { ServiceAuthModule } from '../service-auth/service-auth.module';
import { WebhooksModule } from '../webhooks/webhooks.module';

@Module({
  imports: [
    ArcaModule,
    CertsModule,
    IssuersModule,
    ServiceAuthModule,
    WebhooksModule,
  ],
  controllers: [
    VouchersController,
    IssuerVouchersController,
    V1VouchersController,
    ReconciliationController,
    ExportVouchersController,
  ],
  providers: [
    VouchersService,
    IssuerLockService,
    VoucherRetryScheduler,
    ReconciliationService,
    ExportVouchersService,
  ],
  exports: [VouchersService],
})
export class VouchersModule {}
