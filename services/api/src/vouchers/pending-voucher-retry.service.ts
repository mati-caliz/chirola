import { Injectable } from "@nestjs/common";
import { issueVoucherSchema, type IssueVoucher } from "@chirola/shared";
import { ArcaRejectionError } from "../arca/wsfe/arca-errors";
import { IssuerLockService } from "./issuer-lock.service";
import { CaeRequestService } from "./cae-request.service";
import { IssuedVoucherRecorder } from "./issued-voucher-recorder.service";
import { PendingVoucherQueue } from "./pending-voucher-queue.service";
import { describeError, type EmissionIssuer, type EmissionOutcome } from "./voucher-emission.types";
import type { PendingVoucherRow } from "./voucher-tables";

@Injectable()
export class PendingVoucherRetryService {
  constructor(
    private readonly issuerLock: IssuerLockService,
    private readonly caeRequests: CaeRequestService,
    private readonly recorder: IssuedVoucherRecorder,
    private readonly queue: PendingVoucherQueue,
  ) {}

  async retryPendingVouchers(): Promise<void> {
    const due = await this.queue.findDue();
    for (const pending of due) {
      await this.processPending(pending);
    }
  }

  private async processPending(pending: PendingVoucherRow): Promise<void> {
    const issuer = await this.queue.findIssuer(pending);
    if (!issuer) {
      await this.queue.fail(pending, "Emisor inexistente.", true);
      return;
    }
    const input = issueVoucherSchema.parse(pending.payload);

    await this.issuerLock.runExclusive(issuer.id, async () => {
      const outcome = await this.obtainCae(issuer, input, pending);
      if (outcome === null) {
        return;
      }
      const issued = await this.recorder.record({
        issuer,
        input,
        outcome,
        idempotencyKey: pending.idempotencyKey ?? undefined,
      });
      await this.queue.complete(pending, issued);
    });
  }

  private async obtainCae(
    issuer: EmissionIssuer,
    input: IssueVoucher,
    pending: PendingVoucherRow,
  ): Promise<EmissionOutcome | null> {
    try {
      return (
        (await this.caeRequests.recoverAlreadyAuthorized(issuer, input, pending)) ??
        (await this.caeRequests.attemptCae(issuer, input))
      );
    } catch (err) {
      if (err instanceof ArcaRejectionError) {
        await this.queue.fail(pending, err.message, true);
      } else {
        await this.queue.bump(pending, describeError(err));
      }
      return null;
    }
  }
}
