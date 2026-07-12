import { Module } from '@nestjs/common';
import { IssuersService } from './issuers.service';
import { IssuersController } from './issuers.controller';
import { CertsModule } from '../certs/certs.module';

@Module({
  imports: [CertsModule],
  controllers: [IssuersController],
  providers: [IssuersService],
  exports: [IssuersService],
})
export class IssuersModule {}
