import { Module } from '@nestjs/common';
import { ArcaModule } from '../arca/arca.module';
import { CertsModule } from '../certs/certs.module';
import { IssuerAuthService } from './issuer-auth.service';
import { IssuerOnboardingService } from './issuer-onboarding.service';

@Module({
  imports: [ArcaModule, CertsModule],
  providers: [IssuerAuthService, IssuerOnboardingService],
  exports: [IssuerAuthService, IssuerOnboardingService],
})
export class IssuerArcaModule {}
