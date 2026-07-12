import * as QRCode from 'qrcode';

/**
 * Renderiza la URL del QR de ARCA como PNG. La URL ya viene armada por
 * `buildQrUrl` (base64 del payload sobre el endpoint de verificación).
 */
export async function renderQrPng(qrUrl: string, width = 320): Promise<Buffer> {
  return QRCode.toBuffer(qrUrl, {
    type: 'png',
    width,
    margin: 1,
    errorCorrectionLevel: 'M',
  });
}

/** Datos del receptor codificados dentro del payload del QR de ARCA. */
export interface ReceptorQr {
  tipoDoc: number;
  nroDoc: string;
}

/**
 * Extrae el receptor (tipo y número de documento) del payload del QR, que es la
 * fuente canónica de AFIP. Devuelve null si la URL no tiene el formato esperado.
 */
export function receptorDesdeQr(qrUrl: string): ReceptorQr | null {
  try {
    const base64 = qrUrl.split('?p=')[1];
    if (!base64) return null;
    const payload = JSON.parse(Buffer.from(base64, 'base64').toString('utf8'));
    if (payload.tipoDocRec == null || payload.nroDocRec == null) return null;
    return {
      tipoDoc: Number(payload.tipoDocRec),
      nroDoc: String(payload.nroDocRec),
    };
  } catch {
    return null;
  }
}
