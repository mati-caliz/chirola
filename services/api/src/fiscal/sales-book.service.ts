import { Injectable } from '@nestjs/common';
import {
  authorizedVoucherStatuses,
  voucherTypeName,
  type SalesBook,
  type SalesBookEntry,
  type SalesBookTotals,
} from '@chirola/shared';
import { PrismaService } from '../prisma/prisma.service';
import { recipientFromQr } from '../vouchers/qr-image.util';
import {
  breakDownVoucherTaxes,
  round2,
  toPesos,
  voucherSign,
  type Numeric,
  type TaxBreakdownItem,
} from './voucher-tax-breakdown';

export interface SalesBookVoucherRow {
  id: string;
  voucherDate: Date;
  voucherType: number;
  number: number;
  salesPoint: { number: number };
  recipientDocType: number | null;
  recipientDocNumber: string | null;
  recipientName: string | null;
  client: { docType: number; docNumber: string; legalName: string | null } | null;
  qrData: string | null;
  currency: string;
  exchangeRate: Numeric;
  tributeAmount: Numeric;
  totalAmount: Numeric;
  cae: string | null;
  items: TaxBreakdownItem[];
}

function monthRange(year: number, month: number): { from: Date; to: Date } {
  return {
    from: new Date(Date.UTC(year, month - 1, 1)),
    to: new Date(Date.UTC(year, month, 1)),
  };
}

function toEntry(voucher: SalesBookVoucherRow): SalesBookEntry {
  const sign = voucherSign(voucher.voucherType);
  const signedPesos = (amount: number) => round2(sign * toPesos(voucher, amount));
  const taxes = breakDownVoucherTaxes(voucher);
  const ivaByRate = [...taxes.ivaByRate.entries()]
    .sort(([rateA], [rateB]) => rateB - rateA)
    .map(([rate, amount]) => ({ rate, amount: round2(sign * amount) }));
  const qrRecipient = voucher.qrData ? recipientFromQr(voucher.qrData) : null;

  return {
    voucherId: voucher.id,
    voucherDate: voucher.voucherDate.toISOString(),
    voucherType: voucher.voucherType,
    voucherTypeName: voucherTypeName[voucher.voucherType] ?? String(voucher.voucherType),
    salesPoint: voucher.salesPoint.number,
    number: voucher.number,
    recipientDocType:
      voucher.recipientDocType ?? voucher.client?.docType ?? qrRecipient?.docType ?? null,
    recipientDocNumber:
      voucher.recipientDocNumber ?? voucher.client?.docNumber ?? qrRecipient?.docNumber ?? null,
    recipientName: voucher.recipientName ?? voucher.client?.legalName ?? null,
    currency: voucher.currency,
    exchangeRate: Number(voucher.exchangeRate),
    netAmount: round2(sign * taxes.netAmount),
    exemptAmount: round2(sign * taxes.exemptAmount),
    untaxedAmount: round2(sign * taxes.untaxedAmount),
    ivaByRate,
    ivaAmount: round2(ivaByRate.reduce((total, row) => total + row.amount, 0)),
    tributeAmount: signedPesos(Number(voucher.tributeAmount)),
    totalAmount: signedPesos(Number(voucher.totalAmount)),
    cae: voucher.cae,
  };
}

function sumEntries(entries: SalesBookEntry[]): SalesBookTotals {
  const sum = (pick: (entry: SalesBookEntry) => number) =>
    round2(entries.reduce((total, entry) => total + pick(entry), 0));
  return {
    voucherCount: entries.length,
    netAmount: sum((entry) => entry.netAmount),
    exemptAmount: sum((entry) => entry.exemptAmount),
    untaxedAmount: sum((entry) => entry.untaxedAmount),
    ivaAmount: sum((entry) => entry.ivaAmount),
    tributeAmount: sum((entry) => entry.tributeAmount),
    totalAmount: sum((entry) => entry.totalAmount),
  };
}

export function buildSalesBook(
  year: number,
  month: number,
  vouchers: SalesBookVoucherRow[],
): SalesBook {
  const entries = vouchers.map(toEntry);
  return { year, month, entries, totals: sumEntries(entries) };
}

@Injectable()
export class SalesBookService {
  constructor(private readonly prisma: PrismaService) {}

  async getMonthly(issuerId: string, year: number, month: number): Promise<SalesBook> {
    const { from, to } = monthRange(year, month);
    const vouchers = await this.prisma.voucher.findMany({
      where: {
        issuerId,
        status: { in: [...authorizedVoucherStatuses] },
        voucherDate: { gte: from, lt: to },
      },
      include: { items: true, salesPoint: true, client: true },
      orderBy: [{ voucherDate: 'asc' }, { voucherType: 'asc' }, { number: 'asc' }],
    });
    return buildSalesBook(year, month, vouchers);
  }
}
