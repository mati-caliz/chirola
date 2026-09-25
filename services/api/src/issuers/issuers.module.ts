import { Module } from "@nestjs/common";
import { IssuerArcaModule } from "../issuer-arca/issuer-arca.module";
import { IssuersService } from "./issuers.service";
import { IssuersController } from "./issuers.controller";
import { ArcaParamsService } from "./arca-params.service";
import { ArcaParamCacheService } from "./arca-param-cache.service";
import { SalesPointsService } from "./sales-points.service";
import { ArcaHealthService } from "./arca-health.service";
import { SalesPointsController } from "./sales-points.controller";
import { ArcaCallsController } from "./arca-calls.controller";
import { V1ParamsController } from "./v1-params.controller";
import { V1IssuersController } from "./v1-issuers.controller";
import { CertsModule } from "../certs/certs.module";
import { ArcaModule } from "../arca/arca.module";
import { ServiceAuthModule } from "../service-auth/service-auth.module";

@Module({
  imports: [IssuerArcaModule, CertsModule, ArcaModule, ServiceAuthModule],
  controllers: [
    IssuersController,
    SalesPointsController,
    ArcaCallsController,
    V1ParamsController,
    V1IssuersController,
  ],
  providers: [
    IssuersService,
    ArcaParamsService,
    ArcaParamCacheService,
    SalesPointsService,
    ArcaHealthService,
  ],
  exports: [IssuersService],
})
export class IssuersModule {}
