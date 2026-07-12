import { Module } from '@nestjs/common';
import { CertsService } from './certs.service';

@Module({
  providers: [CertsService],
  exports: [CertsService],
})
export class CertsModule {}
