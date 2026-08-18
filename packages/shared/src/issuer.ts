import { z } from 'zod';

export const createIssuerSchema = z.object({
  cuit: z.string().regex(/^\d{11}$/, 'El CUIT debe tener 11 dígitos'),
  legalName: z.string().min(1),
  ivaCondition: z.enum(['RESPONSABLE_INSCRIPTO', 'MONOTRIBUTO', 'EXENTO']),
  environment: z.enum(['homologacion', 'produccion']).default('homologacion'),
});

export const paymentAccountSchema = z.object({
  cbu: z
    .string()
    .regex(/^\d{22}$/, 'El CBU debe tener 22 dígitos')
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
});

export const matchCertificateSchema = z.object({
  certPem: z.string().min(1),
});

export const updateSalesPointSchema = z.object({
  description: z.string().trim().max(60),
});

export type CreateIssuer = z.infer<typeof createIssuerSchema>;
export type PaymentAccount = z.infer<typeof paymentAccountSchema>;
export type UploadCertificate = z.infer<typeof uploadCertificateSchema>;
export type GenerateCsr = z.infer<typeof generateCsrSchema>;
export type MatchCertificate = z.infer<typeof matchCertificateSchema>;
export type UpdateSalesPoint = z.infer<typeof updateSalesPointSchema>;
