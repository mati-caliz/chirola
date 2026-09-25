import { Injectable, UnprocessableEntityException } from "@nestjs/common";
import {
  creditNoteTypeFor,
  hasText,
  isAuthorizedStatus,
  isCreditInvoice,
  requiresServicePeriod,
  voucherConceptSchema,
  type IssueVoucher,
  type VoucherConceptType,
} from "@chirola/shared";
import type { AuthenticatedApiClient } from "../service-auth/api-client.service";
import { toArcaDate, toLocalIsoDate } from "../arca/arca-date";
import { recipientFromQr, type QrRecipient } from "./qr-image.util";
import { parseTaxTreatment } from "./stored-tax-treatment";
import { VoucherAccessService } from "./voucher-access.service";

type Numeric = number | { toString(): string };

export interface CreditNoteSourceVoucher {
  issuerId: string;
  voucherType: number;
  status: string;
  concept: number;
  number: number;
  voucherDate: Date;
  serviceFrom: Date | null;
  serviceTo: Date | null;
  currency: string;
  exchangeRate: Numeric;
  qrData: string | null;
  recipientDocType: number | null;
  recipientDocNumber: string | null;
  recipientName: string | null;
  salesPoint: { number: number };
  client: { docType: number; docNumber: string; legalName: string | null } | null;
  issuer: { cuit: string };
  items: {
    description: string;
    quantity: Numeric;
    unitPrice: Numeric;
    ivaRate: Numeric;
    taxTreatment: string;
  }[];
}

function qrRecipientOf(voucher: CreditNoteSourceVoucher): QrRecipient | null {
  return hasText(voucher.qrData) ? recipientFromQr(voucher.qrData) : null;
}

function documentTypeOf(voucher: CreditNoteSourceVoucher, fromQr: QrRecipient | null): number | undefined {
  return voucher.recipientDocType ?? voucher.client?.docType ?? fromQr?.docType;
}

function documentNumberOf(voucher: CreditNoteSourceVoucher, fromQr: QrRecipient | null): string | undefined {
  return voucher.recipientDocNumber ?? voucher.client?.docNumber ?? fromQr?.docNumber;
}

function recipientOf(voucher: CreditNoteSourceVoucher): IssueVoucher["recipient"] {
  const fromQr = qrRecipientOf(voucher);
  const docType = documentTypeOf(voucher, fromQr);
  const docNumber = documentNumberOf(voucher, fromQr);
  if (docType === undefined || docNumber === undefined) {
    throw new UnprocessableEntityException("No se pudo identificar al receptor del comprobante original.");
  }
  const legalName = voucher.recipientName ?? voucher.client?.legalName ?? undefined;
  return { docType, docNumber, legalName };
}

function conceptOf(voucher: CreditNoteSourceVoucher): VoucherConceptType {
  const parsed = voucherConceptSchema.safeParse(voucher.concept);
  if (!parsed.success) {
    throw new UnprocessableEntityException("El comprobante original tiene un concepto desconocido.");
  }
  return parsed.data;
}

export function buildCreditNoteDraft(voucher: CreditNoteSourceVoucher, today: Date): IssueVoucher {
  const creditNoteType = creditNoteTypeFor(voucher.voucherType);
  if (creditNoteType === null) {
    throw new UnprocessableEntityException("Este comprobante no admite una nota de crédito desde la app.");
  }
  if (!isAuthorizedStatus(voucher.status)) {
    throw new UnprocessableEntityException(
      "Sólo se puede anular con nota de crédito un comprobante autorizado por ARCA.",
    );
  }

  const needsPaymentDueDate = requiresServicePeriod(voucher.concept) || isCreditInvoice(creditNoteType);
  const servicePeriod =
    requiresServicePeriod(voucher.concept) && voucher.serviceFrom && voucher.serviceTo
      ? { from: toLocalIsoDate(voucher.serviceFrom), to: toLocalIsoDate(voucher.serviceTo) }
      : undefined;

  return {
    issuerId: voucher.issuerId,
    salesPoint: voucher.salesPoint.number,
    voucherType: creditNoteType,
    concept: conceptOf(voucher),
    recipient: recipientOf(voucher),
    items: voucher.items.map((item) => ({
      description: item.description,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
      ivaRate: Number(item.ivaRate),
      taxTreatment: parseTaxTreatment(item.taxTreatment),
    })),
    currency: voucher.currency,
    exchangeRate: Number(voucher.exchangeRate),
    associatedVouchers: [
      {
        type: voucher.voucherType,
        salesPoint: voucher.salesPoint.number,
        number: voucher.number,
        cuit: voucher.issuer.cuit,
        date: toArcaDate(voucher.voucherDate),
      },
    ],
    servicePeriod,
    paymentDueDate: needsPaymentDueDate ? toLocalIsoDate(today) : undefined,
  };
}

@Injectable()
export class CreditNoteDraftService {
  constructor(private readonly access: VoucherAccessService) {}

  async draftForUser(userId: string, voucherId: string): Promise<IssueVoucher> {
    return buildCreditNoteDraft(await this.access.get(userId, voucherId), new Date());
  }

  async draftForApiClient(apiClient: AuthenticatedApiClient, voucherId: string): Promise<IssueVoucher> {
    return buildCreditNoteDraft(await this.access.getForApiClient(apiClient, voucherId), new Date());
  }
}
