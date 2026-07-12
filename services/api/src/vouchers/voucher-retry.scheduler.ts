import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { VouchersService } from './vouchers.service';

const RETRY_INTERVAL_MS = 60_000;

@Injectable()
export class VoucherRetryScheduler {
  private readonly logger = new Logger(VoucherRetryScheduler.name);
  private running = false;

  constructor(private readonly vouchers: VouchersService) {}

  @Interval(RETRY_INTERVAL_MS)
  async retryPending(): Promise<void> {
    if (this.running) {
      return;
    }
    this.running = true;
    try {
      await this.vouchers.retryPendingVouchers();
    } catch (err) {
      this.logger.error(
        `Fallo en el ciclo de reintentos: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    } finally {
      this.running = false;
    }
  }
}
