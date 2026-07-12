import { Module } from '@nestjs/common';
import { ComprobantesService } from './comprobantes.service';
import { ComprobantesController } from './comprobantes.controller';
import { ArcaModule } from '../arca/arca.module';
import { CertsModule } from '../certs/certs.module';

@Module({
  imports: [ArcaModule, CertsModule],
  controllers: [ComprobantesController],
  providers: [ComprobantesService],
})
export class ComprobantesModule {}
