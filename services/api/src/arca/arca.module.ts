import { Module } from '@nestjs/common';
import { WsaaService } from './wsaa/wsaa.service';
import { WsfeService } from './wsfe/wsfe.service';
import { PadronService } from './padron/padron.service';

@Module({
  providers: [WsaaService, WsfeService, PadronService],
  exports: [WsaaService, WsfeService, PadronService],
})
export class ArcaModule {}
