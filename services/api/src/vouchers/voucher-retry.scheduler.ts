import { Injectable, Logger } from "@nestjs/common";
import { Interval } from "@nestjs/schedule";
import { PendingVoucherRetryService } from "./pending-voucher-retry.service";
import { describeError } from "./voucher-emission.types";

const RETRY_INTERVAL_MS = 60_000;

@Injectable()
export class VoucherRetryScheduler {
  private readonly logger = new Logger(VoucherRetryScheduler.name);
  private running = false;

  constructor(private readonly retries: PendingVoucherRetryService) {}

  @Interval(RETRY_INTERVAL_MS)
  async retryPending(): Promise<void> {
    if (this.running) {
      return;
    }
    this.running = true;
    try {
      await this.retries.retryPendingVouchers();
    } catch (err) {
      this.logger.error(`Fallo en el ciclo de reintentos: ${describeError(err)}`);
    } finally {
      this.running = false;
    }
  }
}
