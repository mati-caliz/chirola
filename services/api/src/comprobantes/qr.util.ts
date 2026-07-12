/**
 * Genera la URL del QR obligatorio de ARCA (RG 5152 / RG 4892).
 * Codifica en base64 un JSON con los datos del comprobante y lo antepone al
 * endpoint público de verificación de ARCA.
 */
export interface DatosQr {
  fecha: Date;
  cuitEmisor: string;
  puntoVenta: number;
  tipoCbte: number;
  numero: number;
  importeTotal: number;
  moneda: string;
  cotizacion: number;
  tipoDocReceptor: number;
  nroDocReceptor: string;
  cae: string;
}

const BASE_URL = 'https://www.afip.gob.ar/fe/qr/?p=';

/** Fecha en formato `yyyy-MM-dd` que exige el payload del QR. */
function fechaIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function buildQrUrl(datos: DatosQr): string {
  const payload = {
    ver: 1,
    fecha: fechaIso(datos.fecha),
    cuit: Number(datos.cuitEmisor),
    ptoVta: datos.puntoVenta,
    tipoCmp: datos.tipoCbte,
    nroCmp: datos.numero,
    importe: datos.importeTotal,
    moneda: datos.moneda,
    ctz: datos.cotizacion,
    tipoDocRec: datos.tipoDocReceptor,
    nroDocRec: Number(datos.nroDocReceptor.replace(/-/g, '')),
    tipoCodAut: 'E',
    codAut: Number(datos.cae),
  };
  const base64 = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64');
  return BASE_URL + base64;
}
