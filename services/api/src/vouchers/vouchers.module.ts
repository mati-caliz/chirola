import { Module } from '@nestjs/common';
import { VouchersService } from './vouchers.service';
import { VouchersController } from './vouchers.controller';
import { V1VouchersController } from './v1-vouchers.controller';
import { IssuerLockService } from './issuer-lock.service';
import { VoucherRetryScheduler } from './voucher-retry.scheduler';
import { ReconciliationService } from './reconciliation.service';
import { ReconciliationController } from './reconciliation.controller';
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
    V1VouchersController,
    ReconciliationController,
  ],
  providers: [
    VouchersService,
    IssuerLockService,
    VoucherRetryScheduler,
    ReconciliationService,
  ],
  exports: [VouchersService],
})
export class VouchersModule {}
