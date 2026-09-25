import { z } from "zod";

export const CUIT_LENGTH = 11;

export function normalizeCuit(cuit: string): string {
  return cuit.replace(/\D/g, "");
}

export function isCuit(value: string): boolean {
  return normalizeCuit(value).length === CUIT_LENGTH;
}

export const COMMERCIAL_ADDRESS_MAX_LENGTH = 200;

const commercialAddressField = z
  .string()
  .trim()
  .min(1, "El domicilio comercial no puede quedar vacío")
  .max(
    COMMERCIAL_ADDRESS_MAX_LENGTH,
    `El domicilio comercial admite hasta ${COMMERCIAL_ADDRESS_MAX_LENGTH} caracteres`,
  );

export const createIssuerSchema = z.object({
  cuit: z.string().regex(/^\d{11}$/, "El CUIT debe tener 11 dígitos"),
  legalName: z.string().min(1),
  ivaCondition: z.enum(["RESPONSABLE_INSCRIPTO", "MONOTRIBUTO", "EXENTO"]),
  environment: z.enum(["homologacion", "produccion"]).default("homologacion"),
  commercialAddress: commercialAddressField.optional(),
});

export const commercialAddressSchema = z.object({
  commercialAddress: commercialAddressField.nullable(),
});

export const paymentAccountSchema = z.object({
  cbu: z
    .string()
    .regex(/^\d{22}$/, "El CBU debe tener 22 dígitos")
    .nullable(),
  paymentAlias: z.string().min(6).max(20).nullable().optional(),
});

export const uploadCertificateSchema = z.object({
  privateKeyPem: z.string().min(1),
  certPem: z.string().min(1),
  alias: z.string().optional(),
});

export const generateCsrSchema = z.object({
  alias: z.string().min(1).optional(),

  regenerate: z.boolean().optional(),
});

export const matchCertificateSchema = z.object({
  certPem: z.string().min(1),
});

export const updateSalesPointSchema = z.object({
  description: z.string().trim().max(60),
});

export type CreateIssuer = z.infer<typeof createIssuerSchema>;
export type PaymentAccount = z.infer<typeof paymentAccountSchema>;
export type CommercialAddress = z.infer<typeof commercialAddressSchema>;
export type UploadCertificate = z.infer<typeof uploadCertificateSchema>;
export type GenerateCsr = z.infer<typeof generateCsrSchema>;
export type MatchCertificate = z.infer<typeof matchCertificateSchema>;
export type UpdateSalesPoint = z.infer<typeof updateSalesPointSchema>;

export const representativeSchema = z.object({
  representativeCuit: z
    .string()
    .regex(/^\d{11}$/, "El CUIT debe tener 11 dígitos")
    .nullable(),
});

export type Representative = z.infer<typeof representativeSchema>;
