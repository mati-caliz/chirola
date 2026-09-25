import { z } from "zod";
import {
  isRecipientIvaConditionAllowed,
  recipientIvaConditionName,
  RecipientIvaCondition,
} from "./recipient-iva-condition";
import { ivaRates } from "./iva-rate";
import { hasText } from "./text";
import { DocumentType } from "./document-type";
import { TransmissionType } from "./optional-type";
import {
  discriminatesIva,
  isCreditDebitNote,
  isCreditInvoice,
  requiresRecipientCuit,
  voucherTypeName,
  VoucherType,
} from "./voucher-type";

export * from "./auth";
export * from "./issuer";
export * from "./issuer-onboarding";
export * from "./client";
export * from "./purchase-invoice";
export * from "./recipient-iva-condition";
export * from "./taxpayer";
export * from "./voucher-type";
export * from "./voucher-status";
export * from "./document-type";
export * from "./iva-rate";
export * from "./tribute-type";
export * from "./arca-params";
export * from "./optional-type";
export * from "./export-voucher";
export * from "./emission-plan";
export * from "./pending-voucher";
export * from "./sales-book";
export * from "./arca-health";
export * from "./push-token";
export * from "./money";
export * from "./text";
export * from "./fiscal";
export * from "./currency";
export * from "./voucher-response";

export const FiscalCondition = {
  RESPONSABLE_INSCRIPTO: "RESPONSABLE_INSCRIPTO",
  RESPONSABLE_INSCRIPTO_M: "RESPONSABLE_INSCRIPTO_M",
  MONOTRIBUTISTA: "MONOTRIBUTISTA",
} as const;

export type FiscalConditionType = (typeof FiscalCondition)[keyof typeof FiscalCondition];

export const fiscalConditionName: Record<FiscalConditionType, string> = {
  RESPONSABLE_INSCRIPTO: "Responsable Inscripto",
  RESPONSABLE_INSCRIPTO_M: "Responsable Inscripto (habilitado a emitir M)",
  MONOTRIBUTISTA: "Monotributista",
};

export function inferFiscalCondition(voucherTypeIds: readonly number[]): FiscalConditionType | null {
  if (voucherTypeIds.includes(VoucherType.FACTURA_M)) {
    return FiscalCondition.RESPONSABLE_INSCRIPTO_M;
  }
  if (voucherTypeIds.includes(VoucherType.FACTURA_A) || voucherTypeIds.includes(VoucherType.FACTURA_B)) {
    return FiscalCondition.RESPONSABLE_INSCRIPTO;
  }
  if (voucherTypeIds.includes(VoucherType.FACTURA_C)) {
    return FiscalCondition.MONOTRIBUTISTA;
  }
  return null;
}

export function defaultRecipientIvaCondition(voucherType: number): number {
  return discriminatesIva(voucherType)
    ? RecipientIvaCondition.RESPONSABLE_INSCRIPTO
    : RecipientIvaCondition.CONSUMIDOR_FINAL;
}

export const LOCAL_CURRENCY = "PES";
export const LOCAL_EXCHANGE_RATE = 1;

export const TaxTreatment = {
  TAXED: "TAXED",
  EXEMPT: "EXEMPT",
  UNTAXED: "UNTAXED",
} as const;

export type TaxTreatmentType = (typeof TaxTreatment)[keyof typeof TaxTreatment];

export const taxTreatmentName: Record<TaxTreatmentType, string> = {
  TAXED: "Gravado",
  EXEMPT: "Exento",
  UNTAXED: "No gravado",
};

const taxTreatmentSchema = z
  .enum([TaxTreatment.TAXED, TaxTreatment.EXEMPT, TaxTreatment.UNTAXED])
  .default(TaxTreatment.TAXED);

export const draftAmountsSchema = z.object({
  voucherType: z.number().int().positive(),
  items: z.array(
    z.object({
      quantity: z.number().nonnegative(),
      unitPrice: z.number().nonnegative(),
      ivaRate: z.number().refine((rate) => (ivaRates as readonly number[]).includes(rate)),
      taxTreatment: taxTreatmentSchema,
    }),
  ),
  tributes: z
    .array(
      z.object({
        id: z.number().int().positive(),
        taxableBase: z.number().nonnegative(),
        rate: z.number().nonnegative(),
      }),
    )
    .default([]),
});

export type DraftAmountsInput = z.infer<typeof draftAmountsSchema>;

export const draftAmountsResultSchema = z.object({
  netAmount: z.number(),
  ivaAmount: z.number(),
  exemptAmount: z.number(),
  untaxedAmount: z.number(),
  tributeAmount: z.number(),
  totalAmount: z.number(),
});

export type DraftAmounts = z.infer<typeof draftAmountsResultSchema>;

const supportedIvaRates: readonly number[] = ivaRates;

export const itemSchema = z
  .object({
    description: z.string().min(1),
    quantity: z.number().positive(),
    unitPrice: z.number().nonnegative(),
    ivaRate: z.number().refine((rate) => supportedIvaRates.includes(rate), {
      message: "Alícuota de IVA no soportada",
    }),

    taxTreatment: taxTreatmentSchema,
  })
  .superRefine((item, ctx) => {
    if (item.taxTreatment !== TaxTreatment.TAXED && item.ivaRate !== 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["ivaRate"],
        message: "Los ítems exentos y no gravados no llevan alícuota de IVA.",
      });
    }
  });

export const tributeSchema = z.object({
  id: z.number().int().positive(),
  description: z.string().min(1),
  taxableBase: z.number().nonnegative(),
  rate: z.number().nonnegative(),
});

export type Tribute = z.infer<typeof tributeSchema>;

export const VoucherConcept = {
  PRODUCTS: 1,
  SERVICES: 2,
  PRODUCTS_AND_SERVICES: 3,
} as const;

export type VoucherConceptType = (typeof VoucherConcept)[keyof typeof VoucherConcept];

export const voucherConceptSchema = z.union([
  z.literal(VoucherConcept.PRODUCTS),
  z.literal(VoucherConcept.SERVICES),
  z.literal(VoucherConcept.PRODUCTS_AND_SERVICES),
]);

export const voucherConceptName: Record<number, string> = {
  1: "Productos",
  2: "Servicios",
  3: "Productos y Servicios",
};

const conceptsRequiringServicePeriod: readonly number[] = [
  VoucherConcept.SERVICES,
  VoucherConcept.PRODUCTS_AND_SERVICES,
];

export function requiresServicePeriod(concept: number): boolean {
  return conceptsRequiringServicePeriod.includes(concept);
}

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, {
  message: "La fecha debe tener formato AAAA-MM-DD.",
});

export const servicePeriodSchema = z.object({
  from: isoDate,
  to: isoDate,
});

export type ServicePeriod = z.infer<typeof servicePeriodSchema>;

export const associatedVoucherSchema = z.object({
  type: z.number().int().positive(),
  salesPoint: z.number().int().positive(),
  number: z.number().int().positive(),

  cuit: z
    .string()
    .regex(/^\d{11}$/)
    .optional(),

  date: z
    .string()
    .regex(/^\d{8}$/)
    .optional(),
});

const issueVoucherObjectSchema = z.object({
  issuerId: z.string().min(1),
  salesPoint: z.number().int().positive(),
  voucherType: z.number().int().positive(),
  concept: voucherConceptSchema,
  recipient: z.object({
    docType: z.number().int(),
    docNumber: z.string().min(1),
    legalName: z.string().optional(),

    ivaConditionId: z.number().int().optional(),
  }),
  items: z.array(itemSchema).min(1),
  currency: z.string().default(LOCAL_CURRENCY),
  exchangeRate: z.number().positive().default(LOCAL_EXCHANGE_RATE),

  associatedVouchers: z.array(associatedVoucherSchema).optional(),

  servicePeriod: servicePeriodSchema.optional(),

  paymentDueDate: isoDate.optional(),

  transmissionType: z
    .enum([TransmissionType.OPEN_CIRCULATION, TransmissionType.COLLECTIVE_DEPOSIT])
    .optional(),

  tributes: z.array(tributeSchema).optional(),
});

type IssueVoucherFields = z.infer<typeof issueVoucherObjectSchema>;

function addIssue(ctx: z.RefinementCtx, path: (string | number)[], message: string): void {
  ctx.addIssue({ code: z.ZodIssueCode.custom, path, message });
}

function hasAssociatedVouchers(data: IssueVoucherFields): boolean {
  return data.associatedVouchers !== undefined && data.associatedVouchers.length > 0;
}

function validateAssociatedVouchers(data: IssueVoucherFields, ctx: z.RefinementCtx): void {
  if (isCreditDebitNote(data.voucherType) && !hasAssociatedVouchers(data)) {
    addIssue(
      ctx,
      ["associatedVouchers"],
      "Las notas de crédito/débito requieren al menos un comprobante asociado.",
    );
  }
}

function validateRecipient(data: IssueVoucherFields, ctx: z.RefinementCtx): void {
  if (requiresRecipientCuit(data.voucherType) && data.recipient.docType !== DocumentType.CUIT) {
    addIssue(
      ctx,
      ["recipient", "docType"],
      `${voucherTypeName[data.voucherType] ?? "El comprobante"} requiere identificar al receptor con CUIT.`,
    );
  }

  const ivaConditionId = data.recipient.ivaConditionId ?? defaultRecipientIvaCondition(data.voucherType);
  if (!isRecipientIvaConditionAllowed(data.voucherType, ivaConditionId)) {
    const conditionName = recipientIvaConditionName[ivaConditionId] ?? "undefined";
    const voucherName = voucherTypeName[data.voucherType] ?? "este comprobante";
    addIssue(
      ctx,
      ["recipient", "ivaConditionId"],
      `Un receptor ${conditionName} no puede recibir ${voucherName}.`,
    );
  }
}

function validateServicePeriod(data: IssueVoucherFields, ctx: z.RefinementCtx): void {
  if (!requiresServicePeriod(data.concept)) {
    if (data.servicePeriod) {
      addIssue(ctx, ["servicePeriod"], "El período facturado sólo corresponde a comprobantes de servicios.");
    }
    return;
  }
  if (!data.servicePeriod) {
    addIssue(ctx, ["servicePeriod"], "Los comprobantes de servicios requieren el período facturado.");
  } else if (data.servicePeriod.from > data.servicePeriod.to) {
    addIssue(
      ctx,
      ["servicePeriod", "to"],
      "La fecha de fin del período no puede ser anterior a la de inicio.",
    );
  }
}

function missingPaymentDueDateMessage(voucherType: number): string {
  return isCreditInvoice(voucherType)
    ? "La Factura de Crédito Electrónica MiPyME requiere la fecha de vencimiento de pago."
    : "Los comprobantes de servicios requieren la fecha de vencimiento de pago.";
}

function validatePaymentDueDate(data: IssueVoucherFields, ctx: z.RefinementCtx): void {
  const needsPaymentDueDate = requiresServicePeriod(data.concept) || isCreditInvoice(data.voucherType);
  const hasPaymentDueDate = hasText(data.paymentDueDate);

  if (needsPaymentDueDate && !hasPaymentDueDate) {
    addIssue(ctx, ["paymentDueDate"], missingPaymentDueDateMessage(data.voucherType));
  }

  if (!needsPaymentDueDate && hasPaymentDueDate) {
    addIssue(ctx, ["paymentDueDate"], "La fecha de vencimiento de pago no corresponde a este comprobante.");
  }
}

function validateTransmissionType(data: IssueVoucherFields, ctx: z.RefinementCtx): void {
  if (data.transmissionType && !isCreditInvoice(data.voucherType)) {
    addIssue(
      ctx,
      ["transmissionType"],
      "El tipo de transmisión sólo corresponde a las Facturas de Crédito Electrónica MiPyME.",
    );
  }
}

export const issueVoucherDraftSchema = issueVoucherObjectSchema;

export const issueVoucherSchema = issueVoucherObjectSchema.superRefine((data, ctx) => {
  validateAssociatedVouchers(data, ctx);
  validateRecipient(data, ctx);
  validateServicePeriod(data, ctx);
  validatePaymentDueDate(data, ctx);
  validateTransmissionType(data, ctx);
});

export type Item = z.infer<typeof itemSchema>;
export type AssociatedVoucher = z.infer<typeof associatedVoucherSchema>;
export type IssueVoucher = z.infer<typeof issueVoucherSchema>;

export const shadowCompareSchema = z.object({
  voucher: issueVoucherSchema,
  expected: z.object({
    number: z.number().int().nonnegative().optional(),
    netAmount: z.number(),
    ivaAmount: z.number(),
    totalAmount: z.number(),
  }),
});

export type ShadowCompareInput = z.infer<typeof shadowCompareSchema>;
