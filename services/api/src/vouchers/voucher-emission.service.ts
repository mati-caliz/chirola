import { Injectable } from "@nestjs/common";
import { hasText, type IssueVoucher } from "@chirola/shared";
import { ArcaRejectionError } from "../arca/wsfe/arca-errors";
import { IssuerLockService } from "./issuer-lock.service";
import { VoucherQueuedException } from "./voucher-queued.exception";
import { CaeAttemptError } from "./cae-attempt.error";
import { CaeRequestService } from "./cae-request.service";
import { IssuedVoucherRecorder } from "./issued-voucher-recorder.service";
import { PendingVoucherQueue } from "./pending-voucher-queue.service";
import {
  describeError,
  type EmissionIssuer,
  type EmissionOutcome,
  type IssuedVoucher,
} from "./voucher-emission.types";

@Injectable()
export class VoucherEmissionService {
  constructor(
    private readonly issuerLock: IssuerLockService,
    private readonly caeRequests: CaeRequestService,
    private readonly recorder: IssuedVoucherRecorder,
    private readonly queue: PendingVoucherQueue,
  ) {}

  async issueAuthorized(
    issuer: EmissionIssuer,
    input: IssueVoucher,
    idempotencyKey?: string,
  ): Promise<IssuedVoucher> {
    const replay = await this.replay(issuer.id, idempotencyKey);
    if (replay) {
      return replay;
    }

    return await this.issuerLock.runExclusive(issuer.id, async () => {
      const replayInsideLock = await this.replay(issuer.id, idempotencyKey);
      if (replayInsideLock) {
        return replayInsideLock;
      }
      return await this.emit(issuer, input, idempotencyKey);
    });
  }

  private async replay(issuerId: string, idempotencyKey: string | undefined): Promise<IssuedVoucher | null> {
    if (!hasText(idempotencyKey)) {
      return null;
    }
    return await this.recorder.replayOrQueued(issuerId, idempotencyKey);
  }

  private async emit(
    issuer: EmissionIssuer,
    input: IssueVoucher,
    idempotencyKey: string | undefined,
  ): Promise<IssuedVoucher> {
    let outcome: EmissionOutcome;
    try {
      outcome = await this.caeRequests.attemptCae(issuer, input);
    } catch (err) {
      if (err instanceof ArcaRejectionError) {
        throw err;
      }
      const pending = await this.queue.enqueue({
        issuerId: issuer.id,
        input,
        idempotencyKey,
        lastError: describeError(err),
        attemptedNumber: err instanceof CaeAttemptError ? err.attemptedNumber : null,
      });
      throw new VoucherQueuedException(pending.id);
    }
    return await this.recorder.record({ issuer, input, outcome, idempotencyKey });
  }
}
