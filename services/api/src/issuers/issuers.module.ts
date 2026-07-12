import { Module } from '@nestjs/common';
import { IssuersService } from './issuers.service';
import { IssuersController } from './issuers.controller';
import { ArcaParamsService } from './arca-params.service';
import { V1ParamsController } from './v1-params.controller';
import { CertsModule } from '../certs/certs.module';
import { ArcaModule } from '../arca/arca.module';
import { ServiceAuthModule } from '../service-auth/service-auth.module';

@Module({
  imports: [CertsModule, ArcaModule, ServiceAuthModule],
  controllers: [IssuersController, V1ParamsController],
  providers: [IssuersService, ArcaParamsService],
  exports: [IssuersService],
})
export class IssuersModule {}
