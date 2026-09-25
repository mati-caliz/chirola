import * as QRCode from "qrcode";
import { z } from "zod";
import { hasText } from "@chirola/shared";

const DEFAULT_QR_WIDTH = 320;
const QR_PAYLOAD_SEPARATOR = "?p=";

const qrRecipientPayloadSchema = z.object({
  tipoDocRec: z.unknown(),
  nroDocRec: z.union([z.string(), z.number(), z.boolean()]),
});

export async function renderQrPng(qrUrl: string, width = DEFAULT_QR_WIDTH): Promise<Buffer> {
  return await QRCode.toBuffer(qrUrl, {
    type: "png",
    width,
    margin: 1,
    errorCorrectionLevel: "M",
  });
}

export interface QrRecipient {
  docType: number;
  docNumber: string;
}

export function recipientFromQr(qrUrl: string): QrRecipient | null {
  try {
    const base64 = qrUrl.split(QR_PAYLOAD_SEPARATOR)[1];
    if (!hasText(base64)) return null;
    const decoded: unknown = JSON.parse(Buffer.from(base64, "base64").toString("utf8"));
    const payload = qrRecipientPayloadSchema.safeParse(decoded);
    if (!payload.success) return null;
    const { tipoDocRec, nroDocRec } = payload.data;
    if (tipoDocRec === null || tipoDocRec === undefined) return null;
    return {
      docType: Number(tipoDocRec),
      docNumber: String(nroDocRec),
    };
  } catch {
    return null;
  }
}
