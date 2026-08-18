import { z } from 'zod';
import { VoucherType } from './voucher-type';

export const ExportType = {
  GOODS: 1,
  SERVICES: 2,
  OTHER: 4,
} as const;

export type ExportTypeName = (typeof ExportType)[keyof typeof ExportType];

export const exportTypeName: Record<number, string> = {
  1: 'Exportación definitiva de bienes',
  2: 'Servicios',
  4: 'Otros',
};

export const VoucherLanguage = {
  SPANISH: 1,
  ENGLISH: 2,
  PORTUGUESE: 3,
} as const;

export type VoucherLanguageName =
  (typeof VoucherLanguage)[keyof typeof VoucherLanguage];

export const voucherLanguageName: Record<number, string> = {
  1: 'Español',
  2: 'Inglés',
  3: 'Portugués',
};

export function requiresShippingPermit(exportType: number): boolean {
  return exportType === ExportType.GOODS;
}

const exportItemSchema = z.object({
  code: z.string().min(1).optional(),
  description: z.string().min(1),
  quantity: z.number().positive(),
  unitOfMeasureId: z.number().int().positive(),
  unitPrice: z.number().nonnegative(),
  discount: z.number().nonnegative().default(0),
});

const shippingPermitSchema = z.object({
  permitId: z.string().min(1),
  destinationCountryId: z.number().int().positive(),
});

export const issueExportVoucherSchema = z
  .object({
    issuerId: z.string().min(1),
    salesPoint: z.number().int().positive(),
    voucherType: z.union([
      z.literal(VoucherType.FACTURA_E),
      z.literal(VoucherType.NOTA_DEBITO_E),
      z.literal(VoucherType.NOTA_CREDITO_E),
    ]),
    exportType: z.union([
      z.literal(ExportType.GOODS),
      z.literal(ExportType.SERVICES),
      z.literal(ExportType.OTHER),
    ]),
    destinationCountryId: z.number().int().positive(),
    countryTaxId: z.string().regex(/^\d{11}$/, 'CUIT país inválido'),
    client: z.object({
      legalName: z.string().min(1),
      address: z.string().min(1),
      taxId: z.string().optional(),
    }),
    currency: z.string().min(3),
    exchangeRate: z.number().positive(),
    language: z.union([
      z.literal(VoucherLanguage.SPANISH),
      z.literal(VoucherLanguage.ENGLISH),
      z.literal(VoucherLanguage.PORTUGUESE),
    ]),
    incoterm: z.string().optional(),
    incotermDescription: z.string().optional(),
    paymentMethod: z.string().optional(),
    commercialNotes: z.string().optional(),
    notes: z.string().optional(),
    shippingPermits: z.array(shippingPermitSchema).optional(),
    items: z.array(exportItemSchema).min(1),
    associatedVouchers: z
      .array(
        z.object({
          type: z.number().int().positive(),
          salesPoint: z.number().int().positive(),
          number: z.number().int().positive(),
        }),
      )
      .optional(),
  })
  .superRefine((data, ctx) => {
    const permits = data.shippingPermits ?? [];

    if (!requiresShippingPermit(data.exportType) && permits.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['shippingPermits'],
        message:
          'El permiso de embarque sólo corresponde a la exportación de bienes.',
      });
    }

    if (data.exportType === ExportType.GOODS && !data.incoterm) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['incoterm'],
        message: 'La exportación de bienes requiere el Incoterm.',
      });
    }
  });

export type IssueExportVoucher = z.infer<typeof issueExportVoucherSchema>;
export type ExportItem = z.infer<typeof exportItemSchema>;
export type ShippingPermit = z.infer<typeof shippingPermitSchema>;

export function exportItemTotal(item: {
  quantity: number;
  unitPrice: number;
  discount: number;
}): number {
  const gross = item.quantity * item.unitPrice - item.discount;
  return Math.round((gross + Number.EPSILON) * 100) / 100;
}

export function exportVoucherTotal(
  items: readonly { quantity: number; unitPrice: number; discount: number }[],
): number {
  const sum = items.reduce((acc, item) => acc + exportItemTotal(item), 0);
  return Math.round((sum + Number.EPSILON) * 100) / 100;
}
