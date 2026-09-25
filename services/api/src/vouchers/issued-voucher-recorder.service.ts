import { Inject, Injectable, Logger } from "@nestjs/common";
import { hasText, PendingVoucherStatus, type IssueVoucher } from "@chirola/shared";
import { WebhookService } from "../webhooks/webhook.service";
import { WebhookEvent } from "../webhooks/webhook-events";
import { VoucherQueuedException } from "./voucher-queued.exception";
import { buildQrUrl } from "./qr.util";
import { buildIssuedVoucherData } from "./issued-voucher-data";
import type { WebhookDispatcher } from "./voucher-ports";
import type { EmissionIssuer, EmissionOutcome, IssuedVoucher } from "./voucher-emission.types";
import { VOUCHER_TABLES, type IssuedVoucherTables, type ReplayableVoucher } from "./voucher-tables";

export interface IssuedVoucherRecord {
  issuer: EmissionIssuer;
  input: IssueVoucher;
  outcome: EmissionOutcome;
  idempotencyKey?: string | undefined;
}

function toIssuedVoucher(voucher: ReplayableVoucher & { cae: string }): IssuedVoucher {
  return {
    id: voucher.id,
    voucherType: voucher.voucherType,
    salesPoint: voucher.salesPoint.number,
    number: voucher.number,
    cae: voucher.cae,
    caeExpiration: voucher.caeExpiration ?? voucher.voucherDate,
    netAmount: Number(voucher.netAmount),
    ivaAmount: Number(voucher.ivaAmount),
    totalAmount: Number(voucher.totalAmount),
    qrData: voucher.qrData ?? "",
  };
}

function qrDataFor({ issuer, input, outcome }: IssuedVoucherRecord): string {
  return buildQrUrl({
    date: outcome.date,
    issuerCuit: issuer.cuit,
    salesPoint: input.salesPoint,
    voucherType: input.voucherType,
    number: outcome.number,
    totalAmount: outcome.amounts.totalAmount,
    currency: input.currency,
    exchangeRate: input.exchangeRate,
    recipientDocType: input.recipient.docType,
    recipientDocNumber: input.recipient.docNumber,
    cae: outcome.cae.cae,
  });
}

@Injectable()
export class IssuedVoucherRecorder {
  private readonly logger = new Logger(IssuedVoucherRecorder.name);

  constructor(
    @Inject(VOUCHER_TABLES) private readonly tables: IssuedVoucherTables,
    @Inject(WebhookService) private readonly webhooks: WebhookDispatcher,
  ) {}

  async record(record: IssuedVoucherRecord): Promise<IssuedVoucher> {
    const { issuer, input, outcome, idempotencyKey } = record;
    const { cae, number, amounts } = outcome;
    const qrData = qrDataFor(record);
    const voucherId = await this.createVoucher(record, qrData);

    if (hasText(idempotencyKey)) {
      await this.tables.idempotencyRecord.create({
        data: { issuerId: issuer.id, key: idempotencyKey, voucherId },
      });
    }

    this.logger.log(`Comprobante ${input.voucherType}-${input.salesPoint}-${number} emitido, CAE ${cae.cae}`);

    void this.webhooks.dispatch(issuer.id, WebhookEvent.VOUCHER_ISSUED, {
      voucherId,
      voucherType: input.voucherType,
      salesPoint: input.salesPoint,
      number,
      cae: cae.cae,
      caeExpiration: cae.caeVto.toISOString(),
      totalAmount: amounts.totalAmount,
    });

    return {
      id: voucherId,
      voucherType: input.voucherType,
      salesPoint: input.salesPoint,
      number,
      cae: cae.cae,
      caeExpiration: cae.caeVto,
      netAmount: amounts.netAmount,
      ivaAmount: amounts.ivaAmount,
      totalAmount: amounts.totalAmount,
      qrData,
    };
  }

  async replayOrQueued(issuerId: string, key: string): Promise<IssuedVoucher | null> {
    const replayed = await this.findReplayedVoucher(issuerId, key);
    if (replayed !== null) {
      return replayed;
    }

    const pending = await this.tables.pendingVoucher.findUnique({
      where: { issuerId_idempotencyKey: { issuerId, idempotencyKey: key } },
    });
    if (pending?.status === PendingVoucherStatus.PENDING) {
      throw new VoucherQueuedException(pending.id);
    }
    return null;
  }

  private async findReplayedVoucher(issuerId: string, key: string): Promise<IssuedVoucher | null> {
    const idempotencyRecord = await this.tables.idempotencyRecord.findUnique({
      where: { issuerId_key: { issuerId, key } },
    });
    if (!idempotencyRecord) {
      return null;
    }
    const voucher = await this.tables.voucher.findUnique({
      where: { id: idempotencyRecord.voucherId },
      include: { salesPoint: true },
    });
    if (voucher === null || !hasText(voucher.cae)) {
      return null;
    }
    return toIssuedVoucher({ ...voucher, cae: voucher.cae });
  }

  private async createVoucher(record: IssuedVoucherRecord, qrData: string): Promise<string> {
    const { issuer, input } = record;
    const salesPoint = await this.tables.salesPoint.upsert({
      where: { issuerId_number: { issuerId: issuer.id, number: input.salesPoint } },
      create: { issuerId: issuer.id, number: input.salesPoint },
      update: {},
    });

    const client = await this.tables.client.findUnique({
      where: {
        issuerId_docType_docNumber: {
          issuerId: issuer.id,
          docType: input.recipient.docType,
          docNumber: input.recipient.docNumber,
        },
      },
      select: { id: true, legalName: true },
    });

    const voucher = await this.tables.voucher.create({
      data: buildIssuedVoucherData({
        ...record,
        salesPointId: salesPoint.id,
        client,
        qrData,
      }),
    });
    return voucher.id;
  }
}
