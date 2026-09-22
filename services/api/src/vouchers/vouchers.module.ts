import { Module } from '@nestjs/common';
import { IssuerArcaModule } from '../issuer-arca/issuer-arca.module';
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
import { PendingVouchersService } from './pending-vouchers.service';
import { PendingVouchersController } from './pending-vouchers.controller';
import { V1PendingVouchersController } from './v1-pending-vouchers.controller';
import { CreditNoteDraftService } from './credit-note-draft.service';
import { ArcaModule } from '../arca/arca.module';
import { CertsModule } from '../certs/certs.module';
import { IssuersModule } from '../issuers/issuers.module';
import { ServiceAuthModule } from '../service-auth/service-auth.module';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    IssuerArcaModule,
    ArcaModule,
    CertsModule,
    IssuersModule,
    ServiceAuthModule,
    WebhooksModule,
    NotificationsModule,
  ],
  controllers: [
    VouchersController,
    IssuerVouchersController,
    V1VouchersController,
    ReconciliationController,
    ExportVouchersController,
    PendingVouchersController,
    V1PendingVouchersController,
  ],
  providers: [
    VouchersService,
    IssuerLockService,
    VoucherRetryScheduler,
    ReconciliationService,
    ExportVouchersService,
    PendingVouchersService,
    CreditNoteDraftService,
  ],
  exports: [VouchersService],
})
export class VouchersModule {}
