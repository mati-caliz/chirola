import { z } from 'zod';

const MIN_FISCAL_YEAR = 2000;
const MAX_FISCAL_YEAR = 2100;
const MONTHS_PER_YEAR = 12;

export const fiscalPeriodQuerySchema = z.object({
  issuerId: z.string().min(1),
  year: z.coerce.number().int().min(MIN_FISCAL_YEAR).max(MAX_FISCAL_YEAR),
  month: z.coerce.number().int().min(1).max(MONTHS_PER_YEAR),
});

export type FiscalPeriodQuery = z.infer<typeof fiscalPeriodQuerySchema>;

export interface SalesBookEntry {
  voucherId: string;
  voucherDate: string;
  voucherType: number;
  voucherTypeName: string;
  salesPoint: number;
  number: number;
  recipientDocType: number | null;
  recipientDocNumber: string | null;
  recipientName: string | null;
  currency: string;
  exchangeRate: number;
  netAmount: number;
  exemptAmount: number;
  untaxedAmount: number;
  ivaByRate: { rate: number; amount: number }[];
  ivaAmount: number;
  tributeAmount: number;
  totalAmount: number;
  cae: string | null;
}

export interface SalesBookTotals {
  voucherCount: number;
  netAmount: number;
  exemptAmount: number;
  untaxedAmount: number;
  ivaAmount: number;
  tributeAmount: number;
  totalAmount: number;
}

export interface SalesBook {
  year: number;
  month: number;
  entries: SalesBookEntry[];
  totals: SalesBookTotals;
}
