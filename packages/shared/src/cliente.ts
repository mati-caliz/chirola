import { z } from 'zod';

/** Tipos de documento válidos para un receptor. */
const tiposDocReceptor = [80, 86, 96, 99] as const;
/** Documentos que exigen 11 dígitos (CUIT/CUIL). */
const docsOnce = [80, 86];

const baseCliente = {
  tipoDoc: z
    .number()
    .int()
    .refine((v) => (tiposDocReceptor as readonly number[]).includes(v), {
      message: 'Tipo de documento no soportado',
    }),
  numeroDoc: z.string().min(1),
  razonSocial: z.string().min(1).optional(),
  condicionIva: z.string().min(1).optional(),
  email: z.string().email().optional(),
};

/** Valida que CUIT/CUIL tengan 11 dígitos. */
function validarNumeroDoc(
  data: { tipoDoc: number; numeroDoc?: string },
  ctx: z.RefinementCtx,
): void {
  if (
    data.numeroDoc != null &&
    docsOnce.includes(data.tipoDoc) &&
    !/^\d{11}$/.test(data.numeroDoc)
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['numeroDoc'],
      message: 'CUIT/CUIL debe tener 11 dígitos',
    });
  }
}

export const crearClienteSchema = z
  .object(baseCliente)
  .superRefine(validarNumeroDoc);

/** Todos los campos opcionales; valida CUIT/CUIL si se cambia el número. */
export const actualizarClienteSchema = z
  .object({
    tipoDoc: baseCliente.tipoDoc.optional(),
    numeroDoc: z.string().min(1).optional(),
    razonSocial: z.string().min(1).nullable().optional(),
    condicionIva: z.string().min(1).nullable().optional(),
    email: z.string().email().nullable().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.tipoDoc != null && data.numeroDoc != null) {
      validarNumeroDoc({ tipoDoc: data.tipoDoc, numeroDoc: data.numeroDoc }, ctx);
    }
  });

export type CrearCliente = z.infer<typeof crearClienteSchema>;
export type ActualizarCliente = z.infer<typeof actualizarClienteSchema>;
