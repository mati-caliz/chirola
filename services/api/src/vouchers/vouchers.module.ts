import { Module } from '@nestjs/common';
import { VouchersService } from './vouchers.service';
import { VouchersController } from './vouchers.controller';
import { IssuerLockService } from './issuer-lock.service';
import { ArcaModule } from '../arca/arca.module';
import { CertsModule } from '../certs/certs.module';

@Module({
  imports: [ArcaModule, CertsModule],
  controllers: [VouchersController],
  providers: [VouchersService, IssuerLockService],
})
export class VouchersModule {}
