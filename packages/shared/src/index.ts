import { z } from 'zod';

/** Tipos de comprobante ARCA más usados. */
export const TipoComprobante = {
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

/** Tipos de documento del receptor. */
export const TipoDocumento = {
  CUIT: 80,
  CUIL: 86,
  DNI: 96,
  CONSUMIDOR_FINAL: 99,
} as const;

/** Alícuotas de IVA soportadas (porcentaje). */
export const alicuotasIva = [0, 2.5, 5, 10.5, 21, 27] as const;

export const itemSchema = z.object({
  descripcion: z.string().min(1),
  cantidad: z.number().positive(),
  precioUnit: z.number().nonnegative(),
  alicuotaIva: z.number().refine((v) => (alicuotasIva as readonly number[]).includes(v), {
    message: 'Alícuota de IVA no soportada',
  }),
});

export const emitirComprobanteSchema = z.object({
  emisorId: z.string().min(1),
  puntoVenta: z.number().int().positive(),
  tipoCbte: z.number().int().positive(),
  concepto: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  receptor: z.object({
    tipoDoc: z.number().int(),
    numeroDoc: z.string().min(1),
    razonSocial: z.string().optional(),
  }),
  items: z.array(itemSchema).min(1),
  moneda: z.string().default('PES'),
  cotizacion: z.number().positive().default(1),
});

export type Item = z.infer<typeof itemSchema>;
export type EmitirComprobante = z.infer<typeof emitirComprobanteSchema>;
