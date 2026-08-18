import { Module } from '@nestjs/common';
import { IssuersService } from './issuers.service';
import { IssuersController } from './issuers.controller';
import { ArcaParamsService } from './arca-params.service';
import { ArcaParamCacheService } from './arca-param-cache.service';
import { SalesPointsService } from './sales-points.service';
import { SalesPointsController } from './sales-points.controller';
import { V1ParamsController } from './v1-params.controller';
import { V1IssuersController } from './v1-issuers.controller';
import { CertsModule } from '../certs/certs.module';
import { ArcaModule } from '../arca/arca.module';
import { ServiceAuthModule } from '../service-auth/service-auth.module';

@Module({
  imports: [CertsModule, ArcaModule, ServiceAuthModule],
  controllers: [
    IssuersController,
    SalesPointsController,
    V1ParamsController,
    V1IssuersController,
  ],
  providers: [
    IssuersService,
    ArcaParamsService,
    ArcaParamCacheService,
    SalesPointsService,
  ],
  exports: [IssuersService],
})
export class IssuersModule {}
