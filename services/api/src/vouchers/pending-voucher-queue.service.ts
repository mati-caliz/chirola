import { Inject, Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { hasText, PendingVoucherStatus, type IssueVoucher } from "@chirola/shared";
import { WebhookService } from "../webhooks/webhook.service";
import { WebhookEvent } from "../webhooks/webhook-events";
import { PushNotificationService } from "../notifications/push-notification.service";
import { queuedVoucherAuthorizedMessage, queuedVoucherFailedMessage } from "../notifications/push-messages";
import {
  VOUCHER_RETRY_POLICY,
  type IssuerOwnerNotifier,
  type VoucherRetryPolicy,
  type WebhookDispatcher,
} from "./voucher-ports";
import type { IssuedVoucher, StoredIssuer } from "./voucher-emission.types";
import { VOUCHER_TABLES, type PendingVoucherRow, type PendingVoucherTables } from "./voucher-tables";
import { optionalField } from "../common/optional-field";

const RETRY_BATCH_SIZE = 25;
const UNIQUE_CONSTRAINT_VIOLATION = "P2002";
const BACKOFF_FACTOR = 2;

export interface PendingVoucherEntry {
  issuerId: string;
  input: IssueVoucher;
  idempotencyKey: string | undefined;
  lastError: string;
  attemptedNumber: number | null;
}

function isJsonObject(value: unknown): value is Prisma.InputJsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toJsonPayload(input: IssueVoucher): Prisma.InputJsonObject {
  const payload: unknown = JSON.parse(JSON.stringify(input));
  if (!isJsonObject(payload)) {
    throw new Error("El comprobante a encolar no se pudo serializar como objeto JSON.");
  }
  return payload;
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === UNIQUE_CONSTRAINT_VIOLATION;
}

@Injectable()
export class PendingVoucherQueue {
  private readonly logger = new Logger(PendingVoucherQueue.name);

  constructor(
    @Inject(VOUCHER_TABLES) private readonly tables: PendingVoucherTables,
    @Inject(VOUCHER_RETRY_POLICY) private readonly policy: VoucherRetryPolicy,
    @Inject(PushNotificationService) private readonly push: IssuerOwnerNotifier,
    @Inject(WebhookService) private readonly webhooks: WebhookDispatcher,
  ) {}

  async enqueue(entry: PendingVoucherEntry): Promise<PendingVoucherRow> {
    const { issuerId, input, idempotencyKey, lastError, attemptedNumber } = entry;
    const payload = toJsonPayload(input);
    const nextRetryAt = new Date(Date.now() + this.policy.retryBaseMs);
    try {
      return await this.tables.pendingVoucher.create({
        data: {
          issuerId,
          ...optionalField("idempotencyKey", idempotencyKey),
          payload,
          nextRetryAt,
          lastError,
          attemptedNumber,
          attemptedSalesPoint: attemptedNumber === null ? null : input.salesPoint,
          attemptedAt: attemptedNumber === null ? null : new Date(),
        },
      });
    } catch (err) {
      const existing = await this.findExistingOnConflict(err, issuerId, idempotencyKey);
      if (existing) {
        return existing;
      }
      throw err;
    }
  }

  findDue(): Promise<PendingVoucherRow[]> {
    return this.tables.pendingVoucher.findMany({
      where: {
        status: PendingVoucherStatus.PENDING,
        nextRetryAt: { lte: new Date() },
      },
      take: RETRY_BATCH_SIZE,
    });
  }

  findIssuer(pending: PendingVoucherRow): Promise<StoredIssuer | null> {
    return this.tables.issuer.findUnique({ where: { id: pending.issuerId } });
  }

  async complete(pending: PendingVoucherRow, issued: IssuedVoucher): Promise<void> {
    await this.tables.pendingVoucher.delete({ where: { id: pending.id } });
    void this.push.notifyIssuerOwner(pending.issuerId, queuedVoucherAuthorizedMessage(issued));
  }

  async bump(pending: PendingVoucherRow, lastError: string): Promise<void> {
    const retryCount = pending.retryCount + 1;
    if (retryCount >= this.policy.maxRetries) {
      await this.fail(pending, lastError, false);
      return;
    }
    const nextRetryAt = new Date(Date.now() + this.policy.retryBaseMs * BACKOFF_FACTOR ** retryCount);
    await this.tables.pendingVoucher.update({
      where: { id: pending.id },
      data: { retryCount, nextRetryAt, lastError },
    });
    this.logger.warn(
      `Comprobante encolado ${pending.id} reintentará (intento ${retryCount}) tras ${lastError}`,
    );
  }

  async fail(pending: PendingVoucherRow, reason: string, permanent: boolean): Promise<void> {
    await this.tables.pendingVoucher.update({
      where: { id: pending.id },
      data: {
        status: PendingVoucherStatus.FAILED,
        lastError: reason,
        retryCount: pending.retryCount + 1,
      },
    });
    this.logger.error(`Comprobante encolado ${pending.id} falló definitivamente: ${reason}`);
    void this.push.notifyIssuerOwner(pending.issuerId, queuedVoucherFailedMessage(pending.id, reason));
    void this.webhooks.dispatch(pending.issuerId, WebhookEvent.VOUCHER_FAILED, {
      pendingVoucherId: pending.id,
      reason,
      permanent,
      exhausted: !permanent,
    });
  }

  private async findExistingOnConflict(
    error: unknown,
    issuerId: string,
    idempotencyKey: string | undefined,
  ): Promise<PendingVoucherRow | null> {
    if (!isUniqueViolation(error) || !hasText(idempotencyKey)) {
      return null;
    }
    return await this.tables.pendingVoucher.findUnique({
      where: { issuerId_idempotencyKey: { issuerId, idempotencyKey } },
    });
  }
}
