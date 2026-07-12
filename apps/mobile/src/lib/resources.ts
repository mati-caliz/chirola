import type {
  ActualizarCliente,
  CrearCliente,
  CrearEmisor,
  EmitirComprobante,
} from '@chirola/shared';
import { apiFetch } from './api';

// --- Formas de respuesta del backend (Decimals/fechas viajan como string por JSON) ---

export interface Emisor {
  id: string;
  cuit: string;
  razonSocial: string;
  condicionIva: string;
  ambiente: string;
  createdAt: string;
  updatedAt: string;
  certificado: { alias: string | null; validoHasta: string | null } | null;
}

export interface Cliente {
  id: string;
  emisorId: string;
  tipoDoc: number;
  numeroDoc: string;
  razonSocial: string | null;
  condicionIva: string | null;
  email: string | null;
}

/** Respuesta de `POST /comprobantes`. */
export interface ComprobanteEmitido {
  id: string;
  tipoCbte: number;
  puntoVenta: number;
  numero: number;
  cae: string;
  caeVto: string;
  impNeto: number;
  impIva: number;
  impTotal: number;
  qrData: string;
}

export interface ItemComprobante {
  id: string;
  descripcion: string;
  cantidad: string;
  precioUnit: string;
  alicuotaIva: string;
  subtotal: string;
}

/** Respuesta de `GET /comprobantes/:id` (incluye relaciones). */
export interface ComprobanteDetalle {
  id: string;
  tipoCbte: number;
  numero: number;
  fechaCbte: string;
  concepto: number;
  impNeto: string;
  impIva: string;
  impTotal: string;
  moneda: string;
  estado: string;
  cae: string | null;
  caeVto: string | null;
  qrData: string | null;
  items: ItemComprobante[];
  puntoVenta: { numero: number };
  emisor: { razonSocial: string; cuit: string };
  cliente: Cliente | null;
}

// --- Emisores ---

export const listarEmisores = () => apiFetch<Emisor[]>('/emisores');

export const crearEmisor = (body: CrearEmisor) =>
  apiFetch<Emisor>('/emisores', { method: 'POST', body });

export const generarCsr = (emisorId: string, alias?: string) =>
  apiFetch<{ csrPem: string }>(`/emisores/${emisorId}/csr`, {
    method: 'POST',
    body: alias ? { alias } : {},
  });

export const emparejarCert = (emisorId: string, certPem: string) =>
  apiFetch<{ ok: true }>(`/emisores/${emisorId}/certificado`, {
    method: 'PUT',
    body: { certPem },
  });

// --- Clientes (anidados por emisor) ---

export const listarClientes = (emisorId: string) =>
  apiFetch<Cliente[]>(`/emisores/${emisorId}/clientes`);

export const crearCliente = (emisorId: string, body: CrearCliente) =>
  apiFetch<Cliente>(`/emisores/${emisorId}/clientes`, { method: 'POST', body });

export const actualizarCliente = (
  emisorId: string,
  id: string,
  body: ActualizarCliente,
) =>
  apiFetch<Cliente>(`/emisores/${emisorId}/clientes/${id}`, {
    method: 'PATCH',
    body,
  });

// --- Comprobantes ---

export const emitirComprobante = (body: EmitirComprobante) =>
  apiFetch<ComprobanteEmitido>('/comprobantes', { method: 'POST', body });

export const obtenerComprobante = (id: string) =>
  apiFetch<ComprobanteDetalle>(`/comprobantes/${id}`);
