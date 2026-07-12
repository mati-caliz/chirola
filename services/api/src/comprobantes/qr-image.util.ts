import * as QRCode from 'qrcode';

export async function renderQrPng(qrUrl: string, width = 320): Promise<Buffer> {
  return QRCode.toBuffer(qrUrl, {
    type: 'png',
    width,
    margin: 1,
    errorCorrectionLevel: 'M',
  });
}

export interface ReceptorQr {
  tipoDoc: number;
  nroDoc: string;
}

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
