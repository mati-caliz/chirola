import { z } from 'zod';

const cuitRegex = /^\d{11}$/;
const nonNegative = z.number().nonnegative().default(0);

export const purchaseInvoiceSchema = z.object({
  issuerId: z.string().min(1),
  supplierCuit: z.string().regex(cuitRegex, 'CUIT del proveedor inválido'),
  supplierName: z.string().min(1),
  invoiceType: z.number().int().positive(),
  salesPoint: z.number().int().positive(),
  number: z.number().int().positive(),
  issueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida (YYYY-MM-DD)'),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida (YYYY-MM-DD)')
    .optional(),
  netAmount21: nonNegative,
  iva21: nonNegative,
  netAmount105: nonNegative,
  iva105: nonNegative,
  netAmount27: nonNegative,
  iva27: nonNegative,
  exempt: nonNegative,
  untaxed: nonNegative,
});

export const importPurchaseInvoicesSchema = z.object({
  issuerId: z.string().min(1),
  csv: z.string().min(1, 'El archivo está vacío'),
});

export const updatePurchaseInvoiceSchema = purchaseInvoiceSchema.partial().extend({
  issuerId: z.string().min(1),
});

export type PurchaseInvoiceInput = z.infer<typeof purchaseInvoiceSchema>;
export type ImportPurchaseInvoicesInput = z.infer<
  typeof importPurchaseInvoicesSchema
>;
export type UpdatePurchaseInvoiceInput = z.infer<
  typeof updatePurchaseInvoiceSchema
>;

export function purchaseInvoiceTotal(input: {
  netAmount21: number;
  iva21: number;
  netAmount105: number;
  iva105: number;
  netAmount27: number;
  iva27: number;
  exempt: number;
  untaxed: number;
}): number {
  const sum =
    input.netAmount21 +
    input.iva21 +
    input.netAmount105 +
    input.iva105 +
    input.netAmount27 +
    input.iva27 +
    input.exempt +
    input.untaxed;
  return Math.round((sum + Number.EPSILON) * 100) / 100;
}
