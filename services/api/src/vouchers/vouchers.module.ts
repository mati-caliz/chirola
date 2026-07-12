import { Module } from '@nestjs/common';
import { VouchersService } from './vouchers.service';
import { VouchersController } from './vouchers.controller';
import { V1VouchersController } from './v1-vouchers.controller';
import { IssuerLockService } from './issuer-lock.service';
import { ArcaModule } from '../arca/arca.module';
import { CertsModule } from '../certs/certs.module';
import { ServiceAuthModule } from '../service-auth/service-auth.module';

@Module({
  imports: [ArcaModule, CertsModule, ServiceAuthModule],
  controllers: [VouchersController, V1VouchersController],
  providers: [VouchersService, IssuerLockService],
})
export class VouchersModule {}
