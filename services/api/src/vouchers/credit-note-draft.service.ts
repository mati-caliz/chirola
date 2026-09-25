import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import {
  creditNoteTypeFor,
  isAuthorizedStatus,
  isCreditInvoice,
  requiresServicePeriod,
  voucherConceptSchema,
  type IssueVoucher,
  type VoucherConceptType,
} from "@chirola/shared";
import { PrismaService } from "../prisma/prisma.service";
import { ApiClientService, type AuthenticatedApiClient } from "../service-auth/api-client.service";
import { toArcaDate, toLocalIsoDate } from "../arca/arca-date";
import { recipientFromQr } from "./qr-image.util";
import { parseTaxTreatment } from "./stored-tax-treatment";

type LoadedVoucher = Prisma.VoucherGetPayload<{
  include: { items: true; salesPoint: true; client: true; issuer: true };
}>;

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

function recipientOf(voucher: CreditNoteSourceVoucher): IssueVoucher["recipient"] {
  const fromQr = voucher.qrData ? recipientFromQr(voucher.qrData) : null;
  const docType = voucher.recipientDocType ?? voucher.client?.docType ?? fromQr?.docType;
  const docNumber = voucher.recipientDocNumber ?? voucher.client?.docNumber ?? fromQr?.docNumber;
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly apiClients: ApiClientService,
  ) {}

  async draftForUser(userId: string, voucherId: string): Promise<IssueVoucher> {
    const voucher = await this.load(voucherId);
    if (voucher.issuer.userId !== userId) {
      throw new ForbiddenException("El comprobante no pertenece al usuario.");
    }
    return buildCreditNoteDraft(voucher, new Date());
  }

  async draftForApiClient(apiClient: AuthenticatedApiClient, voucherId: string): Promise<IssueVoucher> {
    const voucher = await this.load(voucherId);
    await this.apiClients.assertIssuerGranted(apiClient.id, voucher.issuerId);
    return buildCreditNoteDraft(voucher, new Date());
  }

  private async load(voucherId: string): Promise<LoadedVoucher> {
    const voucher = await this.prisma.voucher.findUnique({
      where: { id: voucherId },
      include: { items: true, salesPoint: true, client: true, issuer: true },
    });
    if (!voucher) {
      throw new NotFoundException("Comprobante inexistente.");
    }
    return voucher;
  }
}
