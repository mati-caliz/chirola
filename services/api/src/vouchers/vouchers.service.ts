import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, type PendingVoucher } from '@prisma/client';
import { z } from 'zod';
import {
  defaultRecipientIvaCondition,
  issueVoucherSchema,
  TaxTreatment,
  type IssueVoucher,
  type TaxTreatmentType,
} from '@chirola/shared';
import { PrismaService } from '../prisma/prisma.service';
import { CertsService } from '../certs/certs.service';
import { WsaaService } from '../arca/wsaa/wsaa.service';
import { WsfeService } from '../arca/wsfe/wsfe.service';
import type {
  AuthContext,
  AuthorizedVoucherDetail,
  CaeRequest,
  CaeResult,
  VoucherAmounts,
} from '../arca/wsfe/wsfe.types';
import {
  ArcaRejectionError,
  ARCA_DUPLICATE_NUMBER_CODE,
} from '../arca/wsfe/arca-errors';
import { calculateAmounts } from '../arca/wsfe/iva-calculator';
import { buildCreditInvoiceOptionals } from '../arca/wsfe/credit-invoice-optionals';
import {
  ApiClientService,
  AuthenticatedApiClient,
} from '../service-auth/api-client.service';
import { WebhookService } from '../webhooks/webhook.service';
import { WebhookEvent } from '../webhooks/webhook-events';
import { IssuerLockService } from './issuer-lock.service';
import { VoucherQueuedException } from './voucher-queued.exception';
import { CaeAttemptError } from './cae-attempt.error';
import { buildQrUrl } from './qr.util';
import { renderQrPng, recipientFromQr } from './qr-image.util';
import { renderVoucherPdf, type TributePdf } from './pdf.util';

interface CaeWithNumber {
  result: CaeResult;
  number: number;
}

interface EmissionOutcome {
  cae: CaeResult;
  number: number;
  amounts: VoucherAmounts;
  date: Date;
}

type PendingVoucherRow = PendingVoucher;

type EmissionIssuer = {
  id: string;
  cuit: string;
  cbu: string | null;
  paymentAlias: string | null;
};

const storedTributesSchema = z.array(
  z.object({ description: z.string(), amount: z.number() }),
);

const storedTaxTreatmentSchema = z.enum([
  TaxTreatment.TAXED,
  TaxTreatment.EXEMPT,
  TaxTreatment.UNTAXED,
]);

function parseStoredTributes(stored: Prisma.JsonValue | null): TributePdf[] {
  const parsed = storedTributesSchema.safeParse(stored);
  return parsed.success ? parsed.data : [];
}

function parseTaxTreatment(stored: string): TaxTreatmentType {
  const parsed = storedTaxTreatmentSchema.safeParse(stored);
  return parsed.success ? parsed.data : TaxTreatment.TAXED;
}

function parseIsoDate(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day);
}

const AMOUNT_TOLERANCE = 0.01;

const DEFAULT_MAX_RETRIES = 8;
const DEFAULT_RETRY_BASE_MS = 60_000;
const RETRY_BATCH_SIZE = 25;

export interface IssuedVoucher {
  id: string;
  voucherType: number;
  salesPoint: number;
  number: number;
  cae: string;
  caeExpiration: Date;
  netAmount: number;
  ivaAmount: number;
  totalAmount: number;
  qrData: string;
}

export interface EmissionPlan {
  salesPoint: number;
  voucherType: number;
  number: number;
  netAmount: number;
  ivaAmount: number;
  totalAmount: number;
  rates: { id: number; taxableBase: number; amount: number }[];
}

@Injectable()
export class VouchersService {
  private readonly logger = new Logger(VouchersService.name);

  private readonly maxRetries: number;
  private readonly retryBaseMs: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly certs: CertsService,
    private readonly wsaa: WsaaService,
    private readonly wsfe: WsfeService,
    private readonly issuerLock: IssuerLockService,
    private readonly apiClients: ApiClientService,
    private readonly webhooks: WebhookService,
    config: ConfigService,
  ) {
    this.maxRetries = config.get<number>('VOUCHER_MAX_RETRIES', DEFAULT_MAX_RETRIES);
    this.retryBaseMs = config.get<number>(
      'VOUCHER_RETRY_BASE_MS',
      DEFAULT_RETRY_BASE_MS,
    );
  }

  private async loadVoucher(id: string) {
    const voucher = await this.prisma.voucher.findUnique({
      where: { id },
      include: { items: true, client: true, salesPoint: true, issuer: true },
    });
    if (!voucher) {
      throw new NotFoundException('Comprobante inexistente.');
    }
    return voucher;
  }

  async get(userId: string, id: string) {
    const voucher = await this.loadVoucher(id);
    if (voucher.issuer.userId !== userId) {
      throw new ForbiddenException('El comprobante no pertenece al usuario.');
    }
    return voucher;
  }

  async getForApiClient(apiClient: AuthenticatedApiClient, id: string) {
    const voucher = await this.loadVoucher(id);
    await this.apiClients.assertIssuerGranted(apiClient.id, voucher.issuerId);
    return voucher;
  }

  async buildQrPngBuffer(userId: string, id: string): Promise<Buffer> {
    const voucher = await this.get(userId, id);
    if (!voucher.qrData) {
      throw new NotFoundException('El comprobante no tiene QR (no autorizado).');
    }
    return renderQrPng(voucher.qrData);
  }

  async renderPdf(userId: string, id: string): Promise<Buffer> {
    const voucher = await this.get(userId, id);
    if (!voucher.qrData || !voucher.cae) {
      throw new NotFoundException(
        'El comprobante no está autorizado todavía (sin CAE/QR).',
      );
    }
    const qrPng = await renderQrPng(voucher.qrData);
    return renderVoucherPdf({
      issuer: {
        legalName: voucher.issuer.legalName,
        cuit: voucher.issuer.cuit,
        ivaCondition: voucher.issuer.ivaCondition,
      },
      recipient: recipientFromQr(voucher.qrData),
      voucherType: voucher.voucherType,
      salesPoint: voucher.salesPoint.number,
      number: voucher.number,
      date: voucher.voucherDate,
      currency: voucher.currency,
      netAmount: Number(voucher.netAmount),
      ivaAmount: Number(voucher.ivaAmount),
      exemptAmount: Number(voucher.exemptAmount),
      untaxedAmount: Number(voucher.untaxedAmount),
      totalAmount: Number(voucher.totalAmount),
      tributes: parseStoredTributes(voucher.tributes),
      cae: voucher.cae,
      caeExpiration: voucher.caeExpiration ?? voucher.voucherDate,
      items: voucher.items.map((it) => ({
        description: it.description,
        quantity: Number(it.quantity),
        unitPrice: Number(it.unitPrice),
        ivaRate: Number(it.ivaRate),
        taxTreatment: parseTaxTreatment(it.taxTreatment),
        subtotal: Number(it.subtotal),
      })),
      servicePeriod:
        voucher.serviceFrom && voucher.serviceTo
          ? { from: voucher.serviceFrom, to: voucher.serviceTo }
          : null,
      paymentDueDate: voucher.paymentDueDate,
      associatedVouchers: Array.isArray(voucher.associatedVouchers)
        ? (voucher.associatedVouchers as unknown as {
            type: number;
            salesPoint: number;
            number: number;
          }[])
        : [],
      qrPng,
    });
  }

  async issue(
    userId: string,
    input: IssueVoucher,
    idempotencyKey?: string,
  ): Promise<IssuedVoucher> {
    const issuer = await this.prisma.issuer.findUnique({
      where: { id: input.issuerId },
    });
    if (!issuer) {
      throw new NotFoundException('Emisor inexistente.');
    }
    if (issuer.userId !== userId) {
      throw new ForbiddenException('El emisor no pertenece al usuario.');
    }
    return this.issueAuthorized(issuer, input, idempotencyKey);
  }

  async issueForApiClient(
    apiClient: AuthenticatedApiClient,
    input: IssueVoucher,
    idempotencyKey?: string,
  ): Promise<IssuedVoucher> {
    const issuer = await this.prisma.issuer.findUnique({
      where: { id: input.issuerId },
    });
    if (!issuer) {
      throw new NotFoundException('Emisor inexistente.');
    }
    await this.apiClients.assertIssuerGranted(apiClient.id, issuer.id);
    return this.issueAuthorized(issuer, input, idempotencyKey);
  }

  async previewForUser(
    userId: string,
    input: IssueVoucher,
  ): Promise<VoucherAmounts> {
    const issuer = await this.prisma.issuer.findUnique({
      where: { id: input.issuerId },
    });
    if (!issuer) {
      throw new NotFoundException('Emisor inexistente.');
    }
    if (issuer.userId !== userId) {
      throw new ForbiddenException('El emisor no pertenece al usuario.');
    }
    return calculateAmounts(input.voucherType, input.items, input.tributes);
  }

  async previewForApiClient(
    apiClient: AuthenticatedApiClient,
    input: IssueVoucher,
  ): Promise<VoucherAmounts> {
    await this.apiClients.assertIssuerGranted(apiClient.id, input.issuerId);
    return calculateAmounts(input.voucherType, input.items, input.tributes);
  }

  async computeEmissionPlanForApiClient(
    apiClient: AuthenticatedApiClient,
    input: IssueVoucher,
  ): Promise<EmissionPlan> {
    await this.apiClients.assertIssuerGranted(apiClient.id, input.issuerId);
    const issuer = await this.prisma.issuer.findUnique({
      where: { id: input.issuerId },
    });
    if (!issuer) {
      throw new NotFoundException('Emisor inexistente.');
    }
    return this.computeEmissionPlan(issuer, input);
  }

  private async computeEmissionPlan(
    issuer: EmissionIssuer,
    input: IssueVoucher,
  ): Promise<EmissionPlan> {
    const credentials = await this.certs.getCredentials(issuer.id);
    const accessTicket = await this.wsaa.getAccessTicket(
      issuer.id,
      credentials,
      'wsfe',
    );
    const auth: AuthContext = {
      issuerId: issuer.id,
      cuit: issuer.cuit,
      token: accessTicket.token,
      sign: accessTicket.sign,
    };
    const last = await this.wsfe.getLastAuthorized(
      auth,
      input.salesPoint,
      input.voucherType,
    );
    const amounts = calculateAmounts(input.voucherType, input.items, input.tributes);
    return {
      salesPoint: input.salesPoint,
      voucherType: input.voucherType,
      number: last + 1,
      netAmount: amounts.netAmount,
      ivaAmount: amounts.ivaAmount,
      totalAmount: amounts.totalAmount,
      rates: amounts.rates,
    };
  }

  private async issueAuthorized(
    issuer: EmissionIssuer,
    input: IssueVoucher,
    idempotencyKey?: string,
  ): Promise<IssuedVoucher> {
    if (idempotencyKey) {
      const replay = await this.replayOrQueued(issuer.id, idempotencyKey);
      if (replay) {
        return replay;
      }
    }

    return this.issuerLock.runExclusive(issuer.id, async () => {
      if (idempotencyKey) {
        const replay = await this.replayOrQueued(issuer.id, idempotencyKey);
        if (replay) {
          return replay;
        }
      }
      return this.emit(issuer, input, idempotencyKey);
    });
  }

  private async emit(
    issuer: EmissionIssuer,
    input: IssueVoucher,
    idempotencyKey?: string,
  ): Promise<IssuedVoucher> {
    let outcome: EmissionOutcome;
    try {
      outcome = await this.attemptCae(issuer, input);
    } catch (err) {
      if (err instanceof ArcaRejectionError) {
        throw err;
      }
      const pending = await this.queuePending(
        issuer.id,
        input,
        idempotencyKey,
        this.errorMessage(err),
        err instanceof CaeAttemptError ? err.attemptedNumber : null,
      );
      throw new VoucherQueuedException(pending.id);
    }
    return this.persistIssuedVoucher(issuer, input, outcome, idempotencyKey);
  }

  private async attemptCae(
    issuer: EmissionIssuer,
    input: IssueVoucher,
  ): Promise<EmissionOutcome> {
    const auth = await this.buildAuth(issuer);

    const amounts = calculateAmounts(input.voucherType, input.items, input.tributes);
    const date = new Date();
    const ivaConditionId =
      input.recipient.ivaConditionId ??
      defaultRecipientIvaCondition(input.voucherType);
    const optionals = buildCreditInvoiceOptionals(
      input.voucherType,
      issuer,
      input.transmissionType,
    );

    const buildRequest = (voucherNumber: number): CaeRequest => ({
      salesPoint: input.salesPoint,
      voucherType: input.voucherType,
      concept: input.concept,
      number: voucherNumber,
      date,
      recipient: {
        docType: input.recipient.docType,
        docNumber: input.recipient.docNumber,
        ivaConditionId,
      },
      amounts,
      currency: input.currency,
      exchangeRate: input.exchangeRate,
      associatedVouchers: input.associatedVouchers,
      servicePeriod: input.servicePeriod,
      paymentDueDate: input.paymentDueDate,
      optionals,
    });

    const { result: cae, number } = await this.requestCaeWithRecovery(
      auth,
      buildRequest,
    );
    return { cae, number, amounts, date };
  }

  private async persistIssuedVoucher(
    issuer: EmissionIssuer,
    input: IssueVoucher,
    outcome: EmissionOutcome,
    idempotencyKey?: string,
  ): Promise<IssuedVoucher> {
    const { cae, number, amounts, date } = outcome;
    const qrData = buildQrUrl({
      date,
      issuerCuit: issuer.cuit,
      salesPoint: input.salesPoint,
      voucherType: input.voucherType,
      number,
      totalAmount: amounts.totalAmount,
      currency: input.currency,
      exchangeRate: input.exchangeRate,
      recipientDocType: input.recipient.docType,
      recipientDocNumber: input.recipient.docNumber,
      cae: cae.cae,
    });

    const salesPoint = await this.prisma.salesPoint.upsert({
      where: { issuerId_number: { issuerId: issuer.id, number: input.salesPoint } },
      create: { issuerId: issuer.id, number: input.salesPoint },
      update: {},
    });

    const voucher = await this.prisma.voucher.create({
      data: {
        issuerId: issuer.id,
        salesPointId: salesPoint.id,
        voucherType: input.voucherType,
        number,
        voucherDate: date,
        concept: input.concept,
        serviceFrom: input.servicePeriod
          ? parseIsoDate(input.servicePeriod.from)
          : null,
        serviceTo: input.servicePeriod
          ? parseIsoDate(input.servicePeriod.to)
          : null,
        paymentDueDate: input.paymentDueDate
          ? parseIsoDate(input.paymentDueDate)
          : null,
        netAmount: amounts.netAmount,
        ivaAmount: amounts.ivaAmount,
        exemptAmount: amounts.exemptAmount,
        untaxedAmount: amounts.untaxedAmount,
        tributeAmount: amounts.tributeAmount,
        totalAmount: amounts.totalAmount,
        tributes: amounts.tributes.length > 0 ? amounts.tributes : undefined,
        currency: input.currency,
        exchangeRate: input.exchangeRate,
        status: 'AUTORIZADO',
        cae: cae.cae,
        caeExpiration: cae.caeVto,
        qrData,
        associatedVouchers: input.associatedVouchers ?? undefined,
        items: {
          create: input.items.map((it) => ({
            description: it.description,
            quantity: it.quantity,
            unitPrice: it.unitPrice,
            ivaRate: it.ivaRate,
            taxTreatment: it.taxTreatment,
            subtotal: Math.round(it.quantity * it.unitPrice * 100) / 100,
          })),
        },
      },
    });

    if (idempotencyKey) {
      await this.prisma.idempotencyRecord.create({
        data: { issuerId: issuer.id, key: idempotencyKey, voucherId: voucher.id },
      });
    }

    this.logger.log(
      `Comprobante ${input.voucherType}-${input.salesPoint}-${number} emitido, CAE ${cae.cae}`,
    );

    void this.webhooks.dispatch(issuer.id, WebhookEvent.VOUCHER_ISSUED, {
      voucherId: voucher.id,
      voucherType: input.voucherType,
      salesPoint: input.salesPoint,
      number,
      cae: cae.cae,
      caeExpiration: cae.caeVto.toISOString(),
      totalAmount: amounts.totalAmount,
    });

    return {
      id: voucher.id,
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

  private async requestCaeWithRecovery(
    auth: AuthContext,
    buildRequest: (number: number) => CaeRequest,
  ): Promise<CaeWithNumber> {
    const { salesPoint } = buildRequest(0);
    let attemptedNumber: number | null = null;
    try {
      return await this.requestCaeAttempt(auth, buildRequest, (candidate) => {
        attemptedNumber = candidate;
      });
    } catch (err) {
      if (err instanceof ArcaRejectionError) {
        throw err;
      }
      throw new CaeAttemptError(err, salesPoint, attemptedNumber);
    }
  }

  private async requestCaeAttempt(
    auth: AuthContext,
    buildRequest: (number: number) => CaeRequest,
    onNumberChosen: (number: number) => void,
  ): Promise<CaeWithNumber> {
    const { salesPoint, voucherType } = buildRequest(0);
    const last = await this.wsfe.getLastAuthorized(auth, salesPoint, voucherType);
    const number = last + 1;
    onNumberChosen(number);
    try {
      const result = await this.wsfe.requestCae(auth, buildRequest(number));
      return { result, number };
    } catch (err) {
      if (
        !(err instanceof ArcaRejectionError) ||
        !err.hasCode(ARCA_DUPLICATE_NUMBER_CODE)
      ) {
        throw err;
      }
      const existing = await this.wsfe.queryVoucher(
        auth,
        salesPoint,
        voucherType,
        number,
      );
      if (existing) {
        this.logger.warn(
          `CAE recuperado tras duplicado ${voucherType}-${salesPoint}-${number}`,
        );
        return { result: existing, number };
      }
      const freshNumber =
        (await this.wsfe.getLastAuthorized(auth, salesPoint, voucherType)) + 1;
      onNumberChosen(freshNumber);
      this.logger.warn(
        `Número duplicado ${voucherType}-${salesPoint}-${number}, reintentando con ${freshNumber}`,
      );
      const result = await this.wsfe.requestCae(auth, buildRequest(freshNumber));
      return { result, number: freshNumber };
    }
  }

  private async replayOrQueued(
    issuerId: string,
    key: string,
  ): Promise<IssuedVoucher | null> {
    const record = await this.prisma.idempotencyRecord.findUnique({
      where: { issuerId_key: { issuerId, key } },
    });
    if (record) {
      const voucher = await this.prisma.voucher.findUnique({
        where: { id: record.voucherId },
        include: { salesPoint: true },
      });
      if (voucher && voucher.cae) {
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
          qrData: voucher.qrData ?? '',
        };
      }
    }

    const pending = await this.prisma.pendingVoucher.findUnique({
      where: { issuerId_idempotencyKey: { issuerId, idempotencyKey: key } },
    });
    if (pending && pending.status === 'PENDIENTE') {
      throw new VoucherQueuedException(pending.id);
    }
    return null;
  }

  private async queuePending(
    issuerId: string,
    input: IssueVoucher,
    idempotencyKey: string | undefined,
    lastError: string,
    attemptedNumber: number | null,
  ): Promise<PendingVoucherRow> {
    const payload = JSON.parse(JSON.stringify(input)) as Prisma.InputJsonObject;
    const nextRetryAt = new Date(Date.now() + this.retryBaseMs);
    try {
      return await this.prisma.pendingVoucher.create({
        data: {
          issuerId,
          idempotencyKey,
          payload,
          nextRetryAt,
          lastError,
          attemptedNumber,
          attemptedSalesPoint: attemptedNumber === null ? null : input.salesPoint,
          attemptedAt: attemptedNumber === null ? null : new Date(),
        },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002' &&
        idempotencyKey
      ) {
        const existing = await this.prisma.pendingVoucher.findUnique({
          where: { issuerId_idempotencyKey: { issuerId, idempotencyKey } },
        });
        if (existing) {
          return existing;
        }
      }
      throw err;
    }
  }

  async retryPendingVouchers(): Promise<void> {
    const due = await this.prisma.pendingVoucher.findMany({
      where: { status: 'PENDIENTE', nextRetryAt: { lte: new Date() } },
      take: RETRY_BATCH_SIZE,
    });
    for (const pending of due) {
      await this.processPending(pending);
    }
  }

  private async processPending(pending: PendingVoucherRow): Promise<void> {
    const issuer = await this.prisma.issuer.findUnique({
      where: { id: pending.issuerId },
    });
    if (!issuer) {
      await this.failPending(pending, 'Emisor inexistente.', true);
      return;
    }
    const input = issueVoucherSchema.parse(pending.payload);

    await this.issuerLock.runExclusive(issuer.id, async () => {
      let outcome: EmissionOutcome;
      try {
        outcome =
          (await this.recoverAlreadyAuthorized(issuer, input, pending)) ??
          (await this.attemptCae(issuer, input));
      } catch (err) {
        if (err instanceof ArcaRejectionError) {
          await this.failPending(pending, err.message, true);
        } else {
          await this.bumpPending(pending, this.errorMessage(err));
        }
        return;
      }
      await this.persistIssuedVoucher(
        issuer,
        input,
        outcome,
        pending.idempotencyKey ?? undefined,
      );
      await this.prisma.pendingVoucher.delete({ where: { id: pending.id } });
    });
  }

  private async recoverAlreadyAuthorized(
    issuer: EmissionIssuer,
    input: IssueVoucher,
    pending: PendingVoucherRow,
  ): Promise<EmissionOutcome | null> {
    if (pending.attemptedNumber === null || pending.attemptedSalesPoint === null) {
      return null;
    }

    const auth = await this.buildAuth(issuer);
    const authorized = await this.wsfe.queryVoucherDetail(
      auth,
      pending.attemptedSalesPoint,
      input.voucherType,
      pending.attemptedNumber,
    );
    if (!authorized) {
      return null;
    }

    const amounts = calculateAmounts(input.voucherType, input.items, input.tributes);
    if (!this.matchesPendingVoucher(authorized, input, amounts)) {
      this.logger.warn(
        `El comprobante ${input.voucherType}-${pending.attemptedSalesPoint}-${pending.attemptedNumber} ya existe en ARCA pero no coincide con el encolado ${pending.id}; se emite uno nuevo.`,
      );
      return null;
    }

    this.logger.warn(
      `Comprobante encolado ${pending.id} ya tenía CAE en ARCA (${authorized.cae.cae}); se adopta en vez de re-emitir.`,
    );
    return {
      cae: authorized.cae,
      number: authorized.number,
      amounts,
      date: authorized.date,
    };
  }

  private matchesPendingVoucher(
    authorized: AuthorizedVoucherDetail,
    input: IssueVoucher,
    amounts: VoucherAmounts,
  ): boolean {
    const sameTotal =
      Math.abs(authorized.totalAmount - amounts.totalAmount) < AMOUNT_TOLERANCE;
    const sameRecipient =
      authorized.recipientDocType === input.recipient.docType &&
      authorized.recipientDocNumber.replace(/\D/g, '') ===
        input.recipient.docNumber.replace(/\D/g, '');
    return sameTotal && sameRecipient;
  }

  private async buildAuth(issuer: {
    id: string;
    cuit: string;
  }): Promise<AuthContext> {
    const credentials = await this.certs.getCredentials(issuer.id);
    const accessTicket = await this.wsaa.getAccessTicket(
      issuer.id,
      credentials,
      'wsfe',
    );
    return {
      issuerId: issuer.id,
      cuit: issuer.cuit,
      token: accessTicket.token,
      sign: accessTicket.sign,
    };
  }

  private async bumpPending(
    pending: PendingVoucherRow,
    lastError: string,
  ): Promise<void> {
    const retryCount = pending.retryCount + 1;
    if (retryCount >= this.maxRetries) {
      await this.failPending(pending, lastError, false);
      return;
    }
    const nextRetryAt = new Date(Date.now() + this.retryBaseMs * 2 ** retryCount);
    await this.prisma.pendingVoucher.update({
      where: { id: pending.id },
      data: { retryCount, nextRetryAt, lastError },
    });
    this.logger.warn(
      `Comprobante encolado ${pending.id} reintentará (intento ${retryCount}) tras ${lastError}`,
    );
  }

  private async failPending(
    pending: PendingVoucherRow,
    reason: string,
    permanent: boolean,
  ): Promise<void> {
    await this.prisma.pendingVoucher.update({
      where: { id: pending.id },
      data: { status: 'ERROR', lastError: reason, retryCount: pending.retryCount + 1 },
    });
    this.logger.error(
      `Comprobante encolado ${pending.id} falló definitivamente: ${reason}`,
    );
    void this.webhooks.dispatch(pending.issuerId, WebhookEvent.VOUCHER_FAILED, {
      pendingVoucherId: pending.id,
      reason,
      permanent,
      exhausted: !permanent,
    });
  }

  private errorMessage(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
  }
}
