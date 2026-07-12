import { z } from 'zod';

export * from './auth';
export * from './emisor';
export * from './cliente';

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

const tiposConCuit: readonly number[] = [
  TipoComprobante.FACTURA_A,
  TipoComprobante.NOTA_DEBITO_A,
  TipoComprobante.NOTA_CREDITO_A,
];

export function requiereCuitReceptor(tipoCbte: number): boolean {
  return tiposConCuit.includes(tipoCbte);
}

const tiposNotaCreditoDebito: readonly number[] = [
  TipoComprobante.NOTA_DEBITO_A,
  TipoComprobante.NOTA_CREDITO_A,
  TipoComprobante.NOTA_DEBITO_B,
  TipoComprobante.NOTA_CREDITO_B,
  TipoComprobante.NOTA_DEBITO_C,
  TipoComprobante.NOTA_CREDITO_C,
];

export function esNotaCreditoDebito(tipoCbte: number): boolean {
  return tiposNotaCreditoDebito.includes(tipoCbte);
}

export const nombreTipoComprobante: Record<number, string> = {
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

export function letraComprobante(tipoCbte: number): string {
  const nombre = nombreTipoComprobante[tipoCbte] ?? '';
  const m = nombre.match(/ ([ABC])$/);
  return m ? m[1] : '';
}

export const TipoDocumento = {
  CUIT: 80,
  CUIL: 86,
  DNI: 96,
  CONSUMIDOR_FINAL: 99,
} as const;

export const nombreTipoDocumento: Record<number, string> = {
  80: 'CUIT',
  86: 'CUIL',
  96: 'DNI',
  99: 'Consumidor Final',
};

export const CondicionIvaReceptor = {
  RESPONSABLE_INSCRIPTO: 1,
  SUJETO_EXENTO: 4,
  CONSUMIDOR_FINAL: 5,
  MONOTRIBUTO: 6,
  MONOTRIBUTISTA_SOCIAL: 13,
} as const;

export function condicionIvaReceptorPorDefecto(tipoCbte: number): number {
  return requiereCuitReceptor(tipoCbte)
    ? CondicionIvaReceptor.RESPONSABLE_INSCRIPTO
    : CondicionIvaReceptor.CONSUMIDOR_FINAL;
}

export const alicuotasIva = [0, 2.5, 5, 10.5, 21, 27] as const;

export const alicuotaIvaAfipId: Record<number, number> = {
  0: 3,
  2.5: 9,
  5: 8,
  10.5: 4,
  21: 5,
  27: 6,
};

export const itemSchema = z.object({
  descripcion: z.string().min(1),
  cantidad: z.number().positive(),
  precioUnit: z.number().nonnegative(),
  alicuotaIva: z.number().refine((v) => (alicuotasIva as readonly number[]).includes(v), {
    message: 'Alícuota de IVA no soportada',
  }),
});

export const comprobanteAsociadoSchema = z.object({
  tipo: z.number().int().positive(),
  puntoVenta: z.number().int().positive(),
  numero: z.number().int().positive(),

  cuit: z.string().regex(/^\d{11}$/).optional(),

  fecha: z.string().regex(/^\d{8}$/).optional(),
});

export const emitirComprobanteSchema = z
  .object({
    emisorId: z.string().min(1),
    puntoVenta: z.number().int().positive(),
    tipoCbte: z.number().int().positive(),
    concepto: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    receptor: z.object({
      tipoDoc: z.number().int(),
      numeroDoc: z.string().min(1),
      razonSocial: z.string().optional(),

      condicionIvaId: z.number().int().optional(),
    }),
    items: z.array(itemSchema).min(1),
    moneda: z.string().default('PES'),
    cotizacion: z.number().positive().default(1),

    comprobantesAsociados: z.array(comprobanteAsociadoSchema).optional(),
  })
  .superRefine((data, ctx) => {
    if (
      esNotaCreditoDebito(data.tipoCbte) &&
      !(data.comprobantesAsociados && data.comprobantesAsociados.length > 0)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['comprobantesAsociados'],
        message:
          'Las notas de crédito/débito requieren al menos un comprobante asociado.',
      });
    }
  });

export type Item = z.infer<typeof itemSchema>;
export type ComprobanteAsociado = z.infer<typeof comprobanteAsociadoSchema>;
export type EmitirComprobante = z.infer<typeof emitirComprobanteSchema>;
