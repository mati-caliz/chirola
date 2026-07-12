import * as QRCode from 'qrcode';

export async function renderQrPng(qrUrl: string, width = 320): Promise<Buffer> {
  return QRCode.toBuffer(qrUrl, {
    type: 'png',
    width,
    margin: 1,
    errorCorrectionLevel: 'M',
  });
}

export interface QrRecipient {
  docType: number;
  docNumber: string;
}

export function recipientFromQr(qrUrl: string): QrRecipient | null {
  try {
    const base64 = qrUrl.split('?p=')[1];
    if (!base64) return null;
    const payload = JSON.parse(Buffer.from(base64, 'base64').toString('utf8'));
    if (payload.tipoDocRec == null || payload.nroDocRec == null) return null;
    return {
      docType: Number(payload.tipoDocRec),
      docNumber: String(payload.nroDocRec),
    };
  } catch {
    return null;
  }
}
