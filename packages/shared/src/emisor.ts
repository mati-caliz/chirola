import { z } from 'zod';

export const crearEmisorSchema = z.object({
  cuit: z.string().regex(/^\d{11}$/, 'El CUIT debe tener 11 dígitos'),
  razonSocial: z.string().min(1),
  condicionIva: z.enum(['RESPONSABLE_INSCRIPTO', 'MONOTRIBUTO', 'EXENTO']),
  ambiente: z.enum(['homologacion', 'produccion']).default('homologacion'),
});

export const cargarCertificadoSchema = z.object({
  privateKeyPem: z.string().min(1),
  certPem: z.string().min(1),
  alias: z.string().optional(),
});

/** Genera un par de claves + CSR en el backend para subir a ARCA. */
export const generarCsrSchema = z.object({
  // Alias del certificado en ARCA (opcional; por defecto se usa la razón social).
  alias: z.string().min(1).optional(),
});

/** Empareja el `.crt` descargado de ARCA con la clave privada ya guardada. */
export const emparejarCertSchema = z.object({
  certPem: z.string().min(1),
});

export type CrearEmisor = z.infer<typeof crearEmisorSchema>;
export type CargarCertificado = z.infer<typeof cargarCertificadoSchema>;
export type GenerarCsr = z.infer<typeof generarCsrSchema>;
export type EmparejarCert = z.infer<typeof emparejarCertSchema>;
