import type { ComprobanteAsociado, Item } from '@chirola/shared';

export interface AuthContext {
  cuit: string;
  token: string;
  sign: string;
}

export interface AlicuotaIvaArca {

  id: number;

  baseImp: number;

  importe: number;
}

export interface ImportesComprobante {
  impNeto: number;
  impIva: number;
  impTotal: number;

  alicuotas: AlicuotaIvaArca[];
}

export interface CaeRequest {
  puntoVenta: number;
  tipoCbte: number;

  concepto: number;
  numero: number;
  fecha: Date;
  receptor: {
    tipoDoc: number;
    numeroDoc: string;

    condicionIvaId: number;
  };
  importes: ImportesComprobante;
  moneda: string;
  cotizacion: number;

  comprobantesAsociados?: ComprobanteAsociado[];
}

export interface CaeResult {
  cae: string;
  caeVto: Date;
}

export interface CalculoComprobanteInput {
  tipoCbte: number;
  items: Item[];
}
