import type { Item } from '@chirola/shared';

/** Credenciales de autenticación ya resueltas (CUIT + TA vigente). */
export interface AuthContext {
  cuit: string;
  token: string;
  sign: string;
}

/** Alícuota de IVA lista para el array `<ar:Iva>` de WSFEv1. */
export interface AlicuotaIvaArca {
  /** Id de la tabla FEParamGetTiposIva. */
  id: number;
  /** Base imponible (neto) sobre la que se aplica la alícuota. */
  baseImp: number;
  /** Importe de IVA resultante. */
  importe: number;
}

/** Importes ya cuadrados para un comprobante. */
export interface ImportesComprobante {
  impNeto: number;
  impIva: number;
  impTotal: number;
  /** Vacío para Factura C (no discrimina IVA). */
  alicuotas: AlicuotaIvaArca[];
}

/** Pedido de CAE para un comprobante concreto. */
export interface CaeRequest {
  puntoVenta: number;
  tipoCbte: number;
  /** 1=Productos, 2=Servicios, 3=Ambos. */
  concepto: number;
  numero: number;
  fecha: Date;
  receptor: {
    tipoDoc: number;
    numeroDoc: string;
    /** Id de CondicionIVAReceptor (obligatorio desde RG 5616). */
    condicionIvaId: number;
  };
  importes: ImportesComprobante;
  moneda: string;
  cotizacion: number;
}

/** Resultado de un CAE otorgado por ARCA. */
export interface CaeResult {
  cae: string;
  caeVto: Date;
}

/** Comprobante de entrada para calcular importes desde los ítems. */
export interface CalculoComprobanteInput {
  tipoCbte: number;
  items: Item[];
}
