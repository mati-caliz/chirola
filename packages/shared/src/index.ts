import { z } from 'zod';
import { RecipientIvaCondition } from './recipient-iva-condition';
import { ivaRates } from './iva-rate';
import {
  isCreditDebitNote,
  requiresRecipientCuit,
  VoucherType,
} from './voucher-type';

export * from './auth';
export * from './issuer';
export * from './client';
export * from './purchase-invoice';
export * from './recipient-iva-condition';
export * from './taxpayer';
export * from './voucher-type';
export * from './document-type';
export * from './iva-rate';
export * from './tribute-type';
export * from './arca-params';

export const FiscalCondition = {
  RESPONSABLE_INSCRIPTO: 'RESPONSABLE_INSCRIPTO',
  MONOTRIBUTISTA: 'MONOTRIBUTISTA',
} as const;

export type FiscalConditionType =
  (typeof FiscalCondition)[keyof typeof FiscalCondition];

export function inferFiscalCondition(
  voucherTypeIds: readonly number[],
): FiscalConditionType | null {
  if (
    voucherTypeIds.includes(VoucherType.FACTURA_A) ||
    voucherTypeIds.includes(VoucherType.FACTURA_B)
  ) {
    return FiscalCondition.RESPONSABLE_INSCRIPTO;
  }
  if (voucherTypeIds.includes(VoucherType.FACTURA_C)) {
    return FiscalCondition.MONOTRIBUTISTA;
  }
  return null;
}

export function defaultRecipientIvaCondition(voucherType: number): number {
  return requiresRecipientCuit(voucherType)
    ? RecipientIvaCondition.RESPONSABLE_INSCRIPTO
    : RecipientIvaCondition.CONSUMIDOR_FINAL;
}

export const LOCAL_CURRENCY = 'PES';
export const LOCAL_EXCHANGE_RATE = 1;

export const TaxTreatment = {
  TAXED: 'TAXED',
  EXEMPT: 'EXEMPT',
  UNTAXED: 'UNTAXED',
} as const;

export type TaxTreatmentType =
  (typeof TaxTreatment)[keyof typeof TaxTreatment];

export const taxTreatmentName: Record<TaxTreatmentType, string> = {
  TAXED: 'Gravado',
  EXEMPT: 'Exento',
  UNTAXED: 'No gravado',
};

export const itemSchema = z
  .object({
    description: z.string().min(1),
    quantity: z.number().positive(),
    unitPrice: z.number().nonnegative(),
    ivaRate: z.number().refine((v) => (ivaRates as readonly number[]).includes(v), {
      message: 'Alícuota de IVA no soportada',
    }),

    taxTreatment: z
      .enum([TaxTreatment.TAXED, TaxTreatment.EXEMPT, TaxTreatment.UNTAXED])
      .default(TaxTreatment.TAXED),
  })
  .superRefine((item, ctx) => {
    if (item.taxTreatment !== TaxTreatment.TAXED && item.ivaRate !== 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['ivaRate'],
        message:
          'Los ítems exentos y no gravados no llevan alícuota de IVA.',
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

export type VoucherConceptType =
  (typeof VoucherConcept)[keyof typeof VoucherConcept];

export const voucherConceptName: Record<number, string> = {
  1: 'Productos',
  2: 'Servicios',
  3: 'Productos y Servicios',
};

const conceptsRequiringServicePeriod: readonly number[] = [
  VoucherConcept.SERVICES,
  VoucherConcept.PRODUCTS_AND_SERVICES,
];

export function requiresServicePeriod(concept: number): boolean {
  return conceptsRequiringServicePeriod.includes(concept);
}

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, {
  message: 'La fecha debe tener formato AAAA-MM-DD.',
});

export const servicePeriodSchema = z.object({
  from: isoDate,
  to: isoDate,
  paymentDueDate: isoDate,
});

export type ServicePeriod = z.infer<typeof servicePeriodSchema>;

export const associatedVoucherSchema = z.object({
  type: z.number().int().positive(),
  salesPoint: z.number().int().positive(),
  number: z.number().int().positive(),

  cuit: z.string().regex(/^\d{11}$/).optional(),

  date: z.string().regex(/^\d{8}$/).optional(),
});

export const issueVoucherSchema = z
  .object({
    issuerId: z.string().min(1),
    salesPoint: z.number().int().positive(),
    voucherType: z.number().int().positive(),
    concept: z.union([
      z.literal(VoucherConcept.PRODUCTS),
      z.literal(VoucherConcept.SERVICES),
      z.literal(VoucherConcept.PRODUCTS_AND_SERVICES),
    ]),
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

    tributes: z.array(tributeSchema).optional(),
  })
  .superRefine((data, ctx) => {
    if (
      isCreditDebitNote(data.voucherType) &&
      !(data.associatedVouchers && data.associatedVouchers.length > 0)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['associatedVouchers'],
        message:
          'Las notas de crédito/débito requieren al menos un comprobante asociado.',
      });
    }

    if (requiresServicePeriod(data.concept)) {
      if (!data.servicePeriod) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['servicePeriod'],
          message:
            'Los comprobantes de servicios requieren el período facturado y la fecha de vencimiento de pago.',
        });
        return;
      }
      if (data.servicePeriod.from > data.servicePeriod.to) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['servicePeriod', 'to'],
          message:
            'La fecha de fin del período no puede ser anterior a la de inicio.',
        });
      }
      return;
    }

    if (data.servicePeriod) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['servicePeriod'],
        message:
          'El período facturado sólo corresponde a comprobantes de servicios.',
      });
    }
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
