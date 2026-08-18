import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { ArcaCallLogService } from './arca-call-log.service';

const PURGE_INTERVAL_MS = 6 * 60 * 60_000;

@Injectable()
export class ArcaCallLogScheduler {
  private readonly logger = new Logger(ArcaCallLogScheduler.name);

  constructor(private readonly callLog: ArcaCallLogService) {}

  @Interval(PURGE_INTERVAL_MS)
  async purge(): Promise<void> {
    try {
      const purged = await this.callLog.purgeExpired();
      if (purged > 0) {
        this.logger.log(`Se borraron ${purged} llamadas a ARCA vencidas.`);
      }
    } catch (err) {
      this.logger.warn(
        `No se pudo purgar el registro de llamadas: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }
}
