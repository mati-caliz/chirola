import { Module } from '@nestjs/common';
import { ShadowService } from './shadow.service';
import { V1ShadowController } from './v1-shadow.controller';
import { VouchersModule } from '../vouchers/vouchers.module';
import { ServiceAuthModule } from '../service-auth/service-auth.module';

@Module({
  imports: [VouchersModule, ServiceAuthModule],
  controllers: [V1ShadowController],
  providers: [ShadowService],
})
export class ShadowModule {}
