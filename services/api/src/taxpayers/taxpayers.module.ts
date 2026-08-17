import { Module } from '@nestjs/common';
import { TaxpayersService } from './taxpayers.service';
import { TaxpayersController } from './taxpayers.controller';
import { CertsModule } from '../certs/certs.module';
import { ArcaModule } from '../arca/arca.module';
import { IssuersModule } from '../issuers/issuers.module';

@Module({
  imports: [CertsModule, ArcaModule, IssuersModule],
  controllers: [TaxpayersController],
  providers: [TaxpayersService],
})
export class TaxpayersModule {}
