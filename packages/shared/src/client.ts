import { z } from 'zod';

const recipientDocTypes = [80, 86, 96, 99] as const;

const elevenDigitDocTypes = [80, 86];

const baseClient = {
  docType: z
    .number()
    .int()
    .refine((v) => (recipientDocTypes as readonly number[]).includes(v), {
      message: 'Tipo de documento no soportado',
    }),
  docNumber: z.string().min(1),
  legalName: z.string().min(1).optional(),
  ivaCondition: z.string().min(1).optional(),
  email: z.string().email().optional(),
};

function validateDocNumber(
  data: { docType: number; docNumber?: string },
  ctx: z.RefinementCtx,
): void {
  if (
    data.docNumber != null &&
    elevenDigitDocTypes.includes(data.docType) &&
    !/^\d{11}$/.test(data.docNumber)
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['docNumber'],
      message: 'CUIT/CUIL debe tener 11 dígitos',
    });
  }
}

export const createClientSchema = z
  .object(baseClient)
  .superRefine(validateDocNumber);

export const updateClientSchema = z
  .object({
    docType: baseClient.docType.optional(),
    docNumber: z.string().min(1).optional(),
    legalName: z.string().min(1).nullable().optional(),
    ivaCondition: z.string().min(1).nullable().optional(),
    email: z.string().email().nullable().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.docType != null && data.docNumber != null) {
      validateDocNumber({ docType: data.docType, docNumber: data.docNumber }, ctx);
    }
  });

export type CreateClient = z.infer<typeof createClientSchema>;
export type UpdateClient = z.infer<typeof updateClientSchema>;
