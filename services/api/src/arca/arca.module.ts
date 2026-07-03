import { Module } from '@nestjs/common';
import { WsaaService } from './wsaa/wsaa.service';

@Module({
  providers: [WsaaService],
  exports: [WsaaService],
})
export class ArcaModule {}
