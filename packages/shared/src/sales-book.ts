import { z } from "zod";

const MIN_FISCAL_YEAR = 2000;
const MAX_FISCAL_YEAR = 2100;
const MONTHS_PER_YEAR = 12;

export const fiscalPeriodQuerySchema = z.object({
  issuerId: z.string().min(1),
  year: z.coerce.number().int().min(MIN_FISCAL_YEAR).max(MAX_FISCAL_YEAR),
  month: z.coerce.number().int().min(1).max(MONTHS_PER_YEAR),
});

export type FiscalPeriodQuery = z.infer<typeof fiscalPeriodQuerySchema>;

export const salesBookEntrySchema = z.object({
  voucherId: z.string(),
  voucherDate: z.string(),
  voucherType: z.number(),
  voucherTypeName: z.string(),
  salesPoint: z.number(),
  number: z.number(),
  recipientDocType: z.number().nullable(),
  recipientDocNumber: z.string().nullable(),
  recipientName: z.string().nullable(),
  currency: z.string(),
  exchangeRate: z.number(),
  netAmount: z.number(),
  exemptAmount: z.number(),
  untaxedAmount: z.number(),
  ivaByRate: z.array(z.object({ rate: z.number(), amount: z.number() })),
  ivaAmount: z.number(),
  tributeAmount: z.number(),
  totalAmount: z.number(),
  cae: z.string().nullable(),
});

export type SalesBookEntry = z.infer<typeof salesBookEntrySchema>;

export const salesBookTotalsSchema = z.object({
  voucherCount: z.number(),
  netAmount: z.number(),
  exemptAmount: z.number(),
  untaxedAmount: z.number(),
  ivaAmount: z.number(),
  tributeAmount: z.number(),
  totalAmount: z.number(),
});

export type SalesBookTotals = z.infer<typeof salesBookTotalsSchema>;

export const salesBookSchema = z.object({
  year: z.number(),
  month: z.number(),
  entries: z.array(salesBookEntrySchema),
  totals: salesBookTotalsSchema,
});

export type SalesBook = z.infer<typeof salesBookSchema>;
