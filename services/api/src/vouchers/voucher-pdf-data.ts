import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { associatedVoucherSchema, type AssociatedVoucher } from "@chirola/shared";
import { recipientFromQr } from "./qr-image.util";
import { parseTaxTreatment } from "./stored-tax-treatment";
import { buildFiscalTransparency } from "./fiscal-transparency";
import type { PdfItem, ServicePeriodPdf, TributePdf, VoucherPdfData } from "./voucher-pdf.types";
import type { VoucherDetail } from "./voucher-tables";

const storedTributesSchema = z.array(
  z.object({
    id: z.number().int().positive().optional(),
    description: z.string(),
    amount: z.number(),
  }),
);

type StoredTribute = z.infer<typeof storedTributesSchema>[number];

const storedAssociatedVouchersSchema = z.array(associatedVoucherSchema);

export type AuthorizedVoucher = VoucherDetail & { qrData: string; cae: string };

function parseStoredTributes(stored: Prisma.JsonValue | null): StoredTribute[] {
  const parsed = storedTributesSchema.safeParse(stored);
  return parsed.success ? parsed.data : [];
}

function toTributePdf(tribute: StoredTribute): TributePdf {
  return { description: tribute.description, amount: tribute.amount };
}

function parseStoredAssociatedVouchers(stored: Prisma.JsonValue | null): AssociatedVoucher[] {
  const parsed = storedAssociatedVouchersSchema.safeParse(stored);
  return parsed.success ? parsed.data : [];
}

function toPdfItem(item: VoucherDetail["items"][number]): PdfItem {
  return {
    description: item.description,
    quantity: Number(item.quantity),
    unitPrice: Number(item.unitPrice),
    ivaRate: Number(item.ivaRate),
    taxTreatment: parseTaxTreatment(item.taxTreatment),
    subtotal: Number(item.subtotal),
  };
}

function servicePeriodOf(voucher: VoucherDetail): ServicePeriodPdf | null {
  return voucher.serviceFrom && voucher.serviceTo
    ? { from: voucher.serviceFrom, to: voucher.serviceTo }
    : null;
}

export function buildVoucherPdfData(voucher: AuthorizedVoucher, qrPng: Buffer): VoucherPdfData {
  const tributes = parseStoredTributes(voucher.tributes);
  const items = voucher.items.map(toPdfItem);
  const ivaAmount = Number(voucher.ivaAmount);
  return {
    issuer: {
      legalName: voucher.issuer.legalName,
      commercialAddress: voucher.issuer.commercialAddress,
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
    ivaAmount,
    exemptAmount: Number(voucher.exemptAmount),
    untaxedAmount: Number(voucher.untaxedAmount),
    totalAmount: Number(voucher.totalAmount),
    tributes: tributes.map(toTributePdf),
    cae: voucher.cae,
    caeExpiration: voucher.caeExpiration ?? voucher.voucherDate,
    items,
    servicePeriod: servicePeriodOf(voucher),
    paymentDueDate: voucher.paymentDueDate,
    associatedVouchers: parseStoredAssociatedVouchers(voucher.associatedVouchers),
    fiscalTransparency: buildFiscalTransparency({
      voucherType: voucher.voucherType,
      ivaAmount,
      items,
      tributes,
    }),
    qrPng,
  };
}
