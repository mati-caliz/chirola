import { voucherTypeName } from "@chirola/shared";
import { formatVoucherNumber } from "@/lib/format";
import type { VoucherDetail } from "@chirola/shared";

export interface VoucherRecipient {
  clientName: string;
  docType: number | null;
  docNumber: string | null;
}

export const voucherTitle = (voucher: VoucherDetail): string => {
  const name = voucherTypeName[voucher.voucherType] ?? `Tipo ${voucher.voucherType}`;
  return `${name} ${formatVoucherNumber(voucher.salesPoint.number, voucher.number)}`;
};

export const voucherRecipient = (voucher: VoucherDetail): VoucherRecipient => ({
  clientName: voucher.recipientName ?? voucher.client?.legalName ?? "Consumidor final",
  docType: voucher.recipientDocType ?? voucher.client?.docType ?? null,
  docNumber: voucher.recipientDocNumber ?? voucher.client?.docNumber ?? null,
});
