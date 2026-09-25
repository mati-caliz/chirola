import { Module } from "@nestjs/common";
import { IvaPositionService } from "./iva-position.service";
import { FiscalAlertsService } from "./fiscal-alerts.service";
import { SalesBookService } from "./sales-book.service";
import { FiscalController } from "./fiscal.controller";
import { V1FiscalController } from "./v1-fiscal.controller";
import { V1SalesBookController } from "./v1-sales-book.controller";
import { IssuersModule } from "../issuers/issuers.module";
import { ServiceAuthModule } from "../service-auth/service-auth.module";

@Module({
  imports: [IssuersModule, ServiceAuthModule],
  controllers: [FiscalController, V1FiscalController, V1SalesBookController],
  providers: [IvaPositionService, FiscalAlertsService, SalesBookService],
})
export class FiscalModule {}
