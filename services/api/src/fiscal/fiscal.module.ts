import { Module } from '@nestjs/common';
import { IvaPositionService } from './iva-position.service';
import { FiscalAlertsService } from './fiscal-alerts.service';
import { FiscalController } from './fiscal.controller';
import { V1FiscalController } from './v1-fiscal.controller';
import { IssuersModule } from '../issuers/issuers.module';
import { ServiceAuthModule } from '../service-auth/service-auth.module';

@Module({
  imports: [IssuersModule, ServiceAuthModule],
  controllers: [FiscalController, V1FiscalController],
  providers: [IvaPositionService, FiscalAlertsService],
})
export class FiscalModule {}
