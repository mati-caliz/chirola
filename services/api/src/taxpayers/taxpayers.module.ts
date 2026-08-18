import { Module } from '@nestjs/common';
import { TaxpayersService } from './taxpayers.service';
import { TaxpayersController } from './taxpayers.controller';
import { V1TaxpayersController } from './v1-taxpayers.controller';
import { CertsModule } from '../certs/certs.module';
import { ArcaModule } from '../arca/arca.module';
import { IssuersModule } from '../issuers/issuers.module';
import { ServiceAuthModule } from '../service-auth/service-auth.module';

@Module({
  imports: [CertsModule, ArcaModule, IssuersModule, ServiceAuthModule],
  controllers: [TaxpayersController, V1TaxpayersController],
  providers: [TaxpayersService],
})
export class TaxpayersModule {}
