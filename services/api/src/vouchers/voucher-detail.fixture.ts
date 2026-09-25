import { Prisma } from "@prisma/client";
import { IssuerOnboardingStatus, TaxTreatment, VoucherStatus, VoucherType } from "@chirola/shared";
import { buildQrUrl } from "./qr.util";
import type { VoucherDetail } from "./voucher-tables";

const ISSUER_ID = "issuer-1";
const OWNER_ID = "user-1";
const ISSUER_CUIT = "20111111112";
const SALES_POINT_NUMBER = 3;
const VOUCHER_NUMBER = 42;
const VOUCHER_DATE = new Date(2026, 8, 10);
const CAE = "75123456789012";
const CAE_EXPIRATION = new Date(2026, 8, 20);
const RECIPIENT_DOC_TYPE = 80;
const RECIPIENT_DOC_NUMBER = "30707153745";
const NET_AMOUNT = 1000;
const IVA_AMOUNT = 210;
const TOTAL_AMOUNT = 1210;
const ITEM_QUANTITY = 2;
const ITEM_UNIT_PRICE = 500;
const ITEM_IVA_RATE = 21;
const CREATED_AT = new Date(2026, 8, 10, 12);

export const FIXTURE_VOUCHER_QR = buildQrUrl({
  date: VOUCHER_DATE,
  issuerCuit: ISSUER_CUIT,
  salesPoint: SALES_POINT_NUMBER,
  voucherType: VoucherType.FACTURA_A,
  number: VOUCHER_NUMBER,
  totalAmount: TOTAL_AMOUNT,
  currency: "PES",
  exchangeRate: 1,
  recipientDocType: RECIPIENT_DOC_TYPE,
  recipientDocNumber: RECIPIENT_DOC_NUMBER,
  cae: CAE,
});

function decimal(value: number): Prisma.Decimal {
  return new Prisma.Decimal(value);
}

function fixtureIssuer(): VoucherDetail["issuer"] {
  return {
    id: ISSUER_ID,
    userId: OWNER_ID,
    cuit: ISSUER_CUIT,
    legalName: "ACME SRL",
    commercialAddress: "Av. Siempreviva 742",
    ivaCondition: "RESPONSABLE_INSCRIPTO",
    environment: "homologacion",
    cbu: null,
    paymentAlias: null,
    representativeCuit: null,
    onboardingStatus: IssuerOnboardingStatus.ISSUING_CONFIRMED,
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
  };
}

function fixtureItem(): VoucherDetail["items"][number] {
  return {
    id: "item-1",
    voucherId: "voucher-1",
    description: "Consultoría",
    quantity: decimal(ITEM_QUANTITY),
    unitPrice: decimal(ITEM_UNIT_PRICE),
    ivaRate: decimal(ITEM_IVA_RATE),
    subtotal: decimal(NET_AMOUNT),
    taxTreatment: TaxTreatment.TAXED,
  };
}

export function buildVoucherDetail(overrides: Partial<VoucherDetail> = {}): VoucherDetail {
  return {
    id: "voucher-1",
    issuerId: ISSUER_ID,
    issuer: fixtureIssuer(),
    salesPointId: "sales-point-1",
    salesPoint: { id: "sales-point-1", issuerId: ISSUER_ID, number: SALES_POINT_NUMBER, description: null },
    clientId: null,
    client: null,
    recipientDocType: RECIPIENT_DOC_TYPE,
    recipientDocNumber: RECIPIENT_DOC_NUMBER,
    recipientName: "Cliente SA",
    voucherType: VoucherType.FACTURA_A,
    number: VOUCHER_NUMBER,
    voucherDate: VOUCHER_DATE,
    concept: 1,
    serviceFrom: null,
    serviceTo: null,
    paymentDueDate: null,
    netAmount: decimal(NET_AMOUNT),
    ivaAmount: decimal(IVA_AMOUNT),
    exemptAmount: decimal(0),
    untaxedAmount: decimal(0),
    tributeAmount: decimal(0),
    totalAmount: decimal(TOTAL_AMOUNT),
    currency: "PES",
    exchangeRate: decimal(1),
    tributes: null,
    status: VoucherStatus.APPROVED,
    cae: CAE,
    caeExpiration: CAE_EXPIRATION,
    qrData: FIXTURE_VOUCHER_QR,
    arcaObservations: null,
    associatedVouchers: null,
    exportDetail: null,
    items: [fixtureItem()],
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
    ...overrides,
  };
}
