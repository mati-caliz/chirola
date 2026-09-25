import { z } from "zod";

const recipientDocTypes = [80, 86, 96, 99] as const;

const supportedDocTypes: readonly number[] = recipientDocTypes;

const elevenDigitDocTypes: readonly number[] = [80, 86];

const baseClient = {
  docType: z
    .number()
    .int()
    .refine((docType) => supportedDocTypes.includes(docType), {
      message: "Tipo de documento no soportado",
    }),
  docNumber: z.string().min(1),
  legalName: z.string().min(1).optional(),
  ivaCondition: z.string().min(1).optional(),
  email: z.string().email().optional(),
};

function validateDocNumber(data: { docType: number; docNumber?: string }, ctx: z.RefinementCtx): void {
  if (
    data.docNumber !== undefined &&
    elevenDigitDocTypes.includes(data.docType) &&
    !/^\d{11}$/.test(data.docNumber)
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["docNumber"],
      message: "CUIT/CUIL debe tener 11 dígitos",
    });
  }
}

export const createClientSchema = z.object(baseClient).superRefine(validateDocNumber);

export const updateClientSchema = z
  .object({
    docType: baseClient.docType.optional(),
    docNumber: z.string().min(1).optional(),
    legalName: z.string().min(1).nullable().optional(),
    ivaCondition: z.string().min(1).nullable().optional(),
    email: z.string().email().nullable().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.docType !== undefined && data.docNumber !== undefined) {
      validateDocNumber({ docType: data.docType, docNumber: data.docNumber }, ctx);
    }
  });

export const clientSchema = z.object({
  id: z.string(),
  issuerId: z.string(),
  docType: z.number(),
  docNumber: z.string(),
  legalName: z.string().nullable(),
  ivaCondition: z.string().nullable(),
  email: z.string().nullable(),
});

export type Client = z.infer<typeof clientSchema>;

export type CreateClient = z.infer<typeof createClientSchema>;
export type UpdateClient = z.infer<typeof updateClientSchema>;
