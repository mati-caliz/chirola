import { toLocalIsoDate } from "../arca/arca-date";

export interface QrData {
  date: Date;
  issuerCuit: string;
  salesPoint: number;
  voucherType: number;
  number: number;
  totalAmount: number;
  currency: string;
  exchangeRate: number;
  recipientDocType: number;
  recipientDocNumber: string;
  cae: string;
}

const BASE_URL = "https://www.afip.gob.ar/fe/qr/?p=";

export function buildQrUrl(data: QrData): string {
  const payload = {
    ver: 1,
    fecha: toLocalIsoDate(data.date),
    cuit: Number(data.issuerCuit),
    ptoVta: data.salesPoint,
    tipoCmp: data.voucherType,
    nroCmp: data.number,
    importe: data.totalAmount,
    moneda: data.currency,
    ctz: data.exchangeRate,
    tipoDocRec: data.recipientDocType,
    nroDocRec: Number(data.recipientDocNumber.replace(/-/g, "")),
    tipoCodAut: "E",
    codAut: Number(data.cae),
  };
  const base64 = Buffer.from(JSON.stringify(payload), "utf8").toString("base64");
  return BASE_URL + base64;
}
