import { z } from "zod";
import { clientSchema } from "./client";

export const issuedVoucherSchema = z.object({
  id: z.string(),
  voucherType: z.number(),
  salesPoint: z.number(),
  number: z.number(),
  cae: z.string(),
  caeExpiration: z.string(),
  netAmount: z.number(),
  ivaAmount: z.number(),
  totalAmount: z.number(),
  qrData: z.string(),
});

export type IssuedVoucher = z.infer<typeof issuedVoucherSchema>;

export const voucherItemSchema = z.object({
  id: z.string(),
  description: z.string(),
  quantity: z.string(),
  unitPrice: z.string(),
  ivaRate: z.string(),
  subtotal: z.string(),
});

export type VoucherItem = z.infer<typeof voucherItemSchema>;

export const voucherObservationSchema = z.object({
  code: z.string(),
  message: z.string(),
});

export type VoucherObservation = z.infer<typeof voucherObservationSchema>;

const voucherSalesPointSchema = z.object({ number: z.number() });

export const voucherDetailSchema = z.object({
  id: z.string(),
  issuerId: z.string(),
  voucherType: z.number(),
  number: z.number(),
  voucherDate: z.string(),
  concept: z.number(),
  netAmount: z.string(),
  ivaAmount: z.string(),
  totalAmount: z.string(),
  currency: z.string(),
  exchangeRate: z.string(),
  status: z.string(),
  cae: z.string().nullable(),
  caeExpiration: z.string().nullable(),
  qrData: z.string().nullable(),
  arcaObservations: z.array(voucherObservationSchema).nullable(),
  recipientDocType: z.number().nullable(),
  recipientDocNumber: z.string().nullable(),
  recipientName: z.string().nullable(),
  items: z.array(voucherItemSchema),
  salesPoint: voucherSalesPointSchema,
  issuer: z.object({ legalName: z.string(), cuit: z.string() }),
  client: clientSchema.nullable(),
});

export type VoucherDetail = z.infer<typeof voucherDetailSchema>;

export const voucherSummarySchema = z.object({
  id: z.string(),
  voucherType: z.number(),
  number: z.number(),
  voucherDate: z.string(),
  status: z.string(),
  cae: z.string().nullable(),
  totalAmount: z.string(),
  currency: z.string(),
  recipientName: z.string().nullable(),
  salesPoint: voucherSalesPointSchema,
  client: z.object({ legalName: z.string().nullable(), docNumber: z.string() }).nullable(),
});

export type VoucherSummary = z.infer<typeof voucherSummarySchema>;
