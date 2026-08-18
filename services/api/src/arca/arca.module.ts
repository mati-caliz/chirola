import { Module } from '@nestjs/common';
import { WsaaService } from './wsaa/wsaa.service';
import { WsfeService } from './wsfe/wsfe.service';
import { PadronService } from './padron/padron.service';
import { ArcaCallLogService } from './arca-call-log.service';
import { ArcaCallLogScheduler } from './arca-call-log.scheduler';
import { ARCA_CALL_RECORDER } from './arca-soap.util';

@Module({
  providers: [
    WsaaService,
    WsfeService,
    PadronService,
    ArcaCallLogService,
    ArcaCallLogScheduler,
    { provide: ARCA_CALL_RECORDER, useExisting: ArcaCallLogService },
  ],
  exports: [WsaaService, WsfeService, PadronService, ArcaCallLogService],
})
export class ArcaModule {}
