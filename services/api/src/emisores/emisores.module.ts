import { Module } from '@nestjs/common';
import { EmisoresService } from './emisores.service';
import { EmisoresController } from './emisores.controller';
import { CertsModule } from '../certs/certs.module';

@Module({
  imports: [CertsModule],
  controllers: [EmisoresController],
  providers: [EmisoresService],
  exports: [EmisoresService],
})
export class EmisoresModule {}
