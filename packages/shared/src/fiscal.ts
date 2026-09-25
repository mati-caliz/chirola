import { z } from "zod";

export const FiscalObligation = {
  IVA_DDJJ: "IVA_DDJJ",
  CARGAS_SOCIALES: "CARGAS_SOCIALES",
  LIBRO_IVA_DIGITAL: "LIBRO_IVA_DIGITAL",
  MONOTRIBUTO: "MONOTRIBUTO",
} as const;

export type FiscalObligationType = (typeof FiscalObligation)[keyof typeof FiscalObligation];

export const VencimientoStatus = {
  OVERDUE: "OVERDUE",
  DUE_SOON: "DUE_SOON",
  UPCOMING: "UPCOMING",
} as const;

export type VencimientoStatusType = (typeof VencimientoStatus)[keyof typeof VencimientoStatus];

export const vencimientoSchema = z.object({
  type: z.nativeEnum(FiscalObligation),
  label: z.string(),
  dueDate: z.string(),
  status: z.nativeEnum(VencimientoStatus),
});

export type Vencimiento = z.infer<typeof vencimientoSchema>;

export const ivaRateBreakdownSchema = z.object({
  rate: z.number(),
  debit: z.number(),
  credit: z.number(),
  balance: z.number(),
});

export type IvaRateBreakdown = z.infer<typeof ivaRateBreakdownSchema>;

export const ivaPositionSchema = z.object({
  year: z.number(),
  month: z.number(),
  breakdown: z.array(ivaRateBreakdownSchema),
  totalDebit: z.number(),
  totalCredit: z.number(),
  balance: z.number(),
});

export type IvaPosition = z.infer<typeof ivaPositionSchema>;

export const certificateExpiryAlertSchema = z.object({
  validUntil: z.string(),
  daysToExpiry: z.number(),
});

export type CertificateExpiryAlert = z.infer<typeof certificateExpiryAlertSchema>;

export const fiscalAlertsSchema = z.object({
  vencimientos: z.array(vencimientoSchema),
  certificate: certificateExpiryAlertSchema.nullable(),
});

export type FiscalAlerts = z.infer<typeof fiscalAlertsSchema>;
