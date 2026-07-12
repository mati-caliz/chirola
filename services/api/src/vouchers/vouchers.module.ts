import { Module } from '@nestjs/common';
import { VouchersService } from './vouchers.service';
import { VouchersController } from './vouchers.controller';
import { V1VouchersController } from './v1-vouchers.controller';
import { IssuerLockService } from './issuer-lock.service';
import { VoucherRetryScheduler } from './voucher-retry.scheduler';
import { ArcaModule } from '../arca/arca.module';
import { CertsModule } from '../certs/certs.module';
import { ServiceAuthModule } from '../service-auth/service-auth.module';
import { WebhooksModule } from '../webhooks/webhooks.module';

@Module({
  imports: [ArcaModule, CertsModule, ServiceAuthModule, WebhooksModule],
  controllers: [VouchersController, V1VouchersController],
  providers: [VouchersService, IssuerLockService, VoucherRetryScheduler],
})
export class VouchersModule {}
