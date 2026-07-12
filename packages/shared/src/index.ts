import { z } from 'zod';

export * from './auth';
export * from './issuer';
export * from './client';
export * from './purchase-invoice';

export const VoucherType = {
  FACTURA_A: 1,
  NOTA_DEBITO_A: 2,
  NOTA_CREDITO_A: 3,
  FACTURA_B: 6,
  NOTA_DEBITO_B: 7,
  NOTA_CREDITO_B: 8,
  FACTURA_C: 11,
  NOTA_DEBITO_C: 12,
  NOTA_CREDITO_C: 13,
} as const;

const typesRequiringCuit: readonly number[] = [
  VoucherType.FACTURA_A,
  VoucherType.NOTA_DEBITO_A,
  VoucherType.NOTA_CREDITO_A,
];

export function requiresRecipientCuit(voucherType: number): boolean {
  return typesRequiringCuit.includes(voucherType);
}

const creditDebitNoteTypes: readonly number[] = [
  VoucherType.NOTA_DEBITO_A,
  VoucherType.NOTA_CREDITO_A,
  VoucherType.NOTA_DEBITO_B,
  VoucherType.NOTA_CREDITO_B,
  VoucherType.NOTA_DEBITO_C,
  VoucherType.NOTA_CREDITO_C,
];

export function isCreditDebitNote(voucherType: number): boolean {
  return creditDebitNoteTypes.includes(voucherType);
}

const creditNoteTypes: readonly number[] = [
  VoucherType.NOTA_CREDITO_A,
  VoucherType.NOTA_CREDITO_B,
  VoucherType.NOTA_CREDITO_C,
];

export function isCreditNote(voucherType: number): boolean {
  return creditNoteTypes.includes(voucherType);
}

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

export const voucherTypeName: Record<number, string> = {
  1: 'Factura A',
  2: 'Nota de Débito A',
  3: 'Nota de Crédito A',
  6: 'Factura B',
  7: 'Nota de Débito B',
  8: 'Nota de Crédito B',
  11: 'Factura C',
  12: 'Nota de Débito C',
  13: 'Nota de Crédito C',
};

export function voucherLetter(voucherType: number): string {
  const name = voucherTypeName[voucherType] ?? '';
  const match = name.match(/ ([ABC])$/);
  return match ? match[1] : '';
}

export const DocumentType = {
  CUIT: 80,
  CUIL: 86,
  DNI: 96,
  CONSUMIDOR_FINAL: 99,
} as const;

export const documentTypeName: Record<number, string> = {
  80: 'CUIT',
  86: 'CUIL',
  96: 'DNI',
  99: 'Consumidor Final',
};

export const RecipientIvaCondition = {
  RESPONSABLE_INSCRIPTO: 1,
  SUJETO_EXENTO: 4,
  CONSUMIDOR_FINAL: 5,
  MONOTRIBUTO: 6,
  MONOTRIBUTISTA_SOCIAL: 13,
} as const;

export function defaultRecipientIvaCondition(voucherType: number): number {
  return requiresRecipientCuit(voucherType)
    ? RecipientIvaCondition.RESPONSABLE_INSCRIPTO
    : RecipientIvaCondition.CONSUMIDOR_FINAL;
}

export const ivaRates = [0, 2.5, 5, 10.5, 21, 27] as const;

export const ivaRateAfipId: Record<number, number> = {
  0: 3,
  2.5: 9,
  5: 8,
  10.5: 4,
  21: 5,
  27: 6,
};

export const itemSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().positive(),
  unitPrice: z.number().nonnegative(),
  ivaRate: z.number().refine((v) => (ivaRates as readonly number[]).includes(v), {
    message: 'Alícuota de IVA no soportada',
  }),
});

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
    concept: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    recipient: z.object({
      docType: z.number().int(),
      docNumber: z.string().min(1),
      legalName: z.string().optional(),

      ivaConditionId: z.number().int().optional(),
    }),
    items: z.array(itemSchema).min(1),
    currency: z.string().default('PES'),
    exchangeRate: z.number().positive().default(1),

    associatedVouchers: z.array(associatedVoucherSchema).optional(),
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
