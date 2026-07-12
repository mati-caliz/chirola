import { z } from 'zod';

export * from './auth';
export * from './emisor';
export * from './cliente';

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

/** Tipos de comprobante que requieren CUIT del receptor (clase A). */
const tiposConCuit: readonly number[] = [
  TipoComprobante.FACTURA_A,
  TipoComprobante.NOTA_DEBITO_A,
  TipoComprobante.NOTA_CREDITO_A,
];

/** ¿El tipo de comprobante exige identificar al receptor con CUIT? */
export function requiereCuitReceptor(tipoCbte: number): boolean {
  return tiposConCuit.includes(tipoCbte);
}

/** Notas de crédito y débito (todas las clases). Exigen `CbtesAsoc` en WSFEv1. */
const tiposNotaCreditoDebito: readonly number[] = [
  TipoComprobante.NOTA_DEBITO_A,
  TipoComprobante.NOTA_CREDITO_A,
  TipoComprobante.NOTA_DEBITO_B,
  TipoComprobante.NOTA_CREDITO_B,
  TipoComprobante.NOTA_DEBITO_C,
  TipoComprobante.NOTA_CREDITO_C,
];

/**
 * ¿El tipo de comprobante es una nota de crédito/débito? Estas requieren
 * asociar el/los comprobante(s) original(es) vía `CbtesAsoc`.
 */
export function esNotaCreditoDebito(tipoCbte: number): boolean {
  return tiposNotaCreditoDebito.includes(tipoCbte);
}

/** Nombre legible del tipo de comprobante (para PDF / UI). */
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

/** Letra del comprobante (A/B/C) según el tipo. */
export function letraComprobante(tipoCbte: number): string {
  const nombre = nombreTipoComprobante[tipoCbte] ?? '';
  const m = nombre.match(/ ([ABC])$/);
  return m ? m[1] : '';
}

/** Tipos de documento del receptor. */
export const TipoDocumento = {
  CUIT: 80,
  CUIL: 86,
  DNI: 96,
  CONSUMIDOR_FINAL: 99,
} as const;

/** Nombre legible del tipo de documento del receptor. */
export const nombreTipoDocumento: Record<number, string> = {
  80: 'CUIT',
  86: 'CUIL',
  96: 'DNI',
  99: 'Consumidor Final',
};

/**
 * Condición del receptor frente al IVA (`CondicionIVAReceptorId`, obligatorio
 * en WSFEv1 desde RG 5616). El id es el que espera ARCA.
 */
export const CondicionIvaReceptor = {
  RESPONSABLE_INSCRIPTO: 1,
  SUJETO_EXENTO: 4,
  CONSUMIDOR_FINAL: 5,
  MONOTRIBUTO: 6,
  MONOTRIBUTISTA_SOCIAL: 13,
} as const;

/** Condición IVA por defecto del receptor según el tipo de comprobante. */
export function condicionIvaReceptorPorDefecto(tipoCbte: number): number {
  return requiereCuitReceptor(tipoCbte)
    ? CondicionIvaReceptor.RESPONSABLE_INSCRIPTO
    : CondicionIvaReceptor.CONSUMIDOR_FINAL;
}

/** Alícuotas de IVA soportadas (porcentaje). */
export const alicuotasIva = [0, 2.5, 5, 10.5, 21, 27] as const;

/**
 * Mapea la alícuota (porcentaje) al `Id` de la tabla FEParamGetTiposIva de ARCA.
 * Fuente: tabla oficial de alícuotas de IVA de WSFEv1.
 */
export const alicuotaIvaAfipId: Record<number, number> = {
  0: 3, // 0%
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

/**
 * Comprobante original asociado a una nota de crédito/débito (`CbteAsoc`).
 * `cuit` y `fecha` son opcionales pero recomendados por ARCA.
 */
export const comprobanteAsociadoSchema = z.object({
  tipo: z.number().int().positive(),
  puntoVenta: z.number().int().positive(),
  numero: z.number().int().positive(),
  /** CUIT del emisor del comprobante asociado (11 dígitos). */
  cuit: z.string().regex(/^\d{11}$/).optional(),
  /** Fecha del comprobante asociado en formato yyyyMMdd. */
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
      /** Id de CondicionIvaReceptor. Si se omite, se deriva del tipo de comprobante. */
      condicionIvaId: z.number().int().optional(),
    }),
    items: z.array(itemSchema).min(1),
    moneda: z.string().default('PES'),
    cotizacion: z.number().positive().default(1),
    /** Comprobantes asociados (obligatorio para notas de crédito/débito). */
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
