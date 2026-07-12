import { Module } from '@nestjs/common';
import { WsaaService } from './wsaa/wsaa.service';
import { WsfeService } from './wsfe/wsfe.service';

@Module({
  providers: [WsaaService, WsfeService],
  exports: [WsaaService, WsfeService],
})
export class ArcaModule {}
