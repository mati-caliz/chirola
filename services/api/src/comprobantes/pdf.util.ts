import PDFDocument from 'pdfkit';
import {
  letraComprobante,
  nombreTipoComprobante,
  nombreTipoDocumento,
} from '@chirola/shared';

export interface ItemPdf {
  descripcion: string;
  cantidad: number;
  precioUnit: number;
  alicuotaIva: number;
  subtotal: number;
}

export interface ComprobanteAsociadoPdf {
  tipo: number;
  puntoVenta: number;
  numero: number;
}

export interface ComprobantePdfData {
  emisor: { razonSocial: string; cuit: string; condicionIva: string };
  receptor: { tipoDoc: number; nroDoc: string } | null;
  tipoCbte: number;
  puntoVenta: number;
  numero: number;
  fecha: Date;
  moneda: string;
  impNeto: number;
  impIva: number;
  impTotal: number;
  cae: string;
  caeVto: Date;
  items: ItemPdf[];
  comprobantesAsociados: ComprobanteAsociadoPdf[];
  /** PNG del QR de ARCA ya renderizado. */
  qrPng: Buffer;
}

const money = (n: number): string =>
  n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fecha = (d: Date): string =>
  `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;

const comprobanteId = (tipo: number, pv: number, nro: number): string =>
  `${nombreTipoComprobante[tipo] ?? `Tipo ${tipo}`} ${String(pv).padStart(5, '0')}-${String(nro).padStart(8, '0')}`;

/** Renderiza el comprobante como PDF A4 con el QR obligatorio de ARCA. */
export function renderComprobantePdf(data: ComprobantePdfData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const left = doc.page.margins.left;
    const right = doc.page.width - doc.page.margins.right;
    const width = right - left;

    // Encabezado: letra grande + identificación del comprobante.
    const letra = letraComprobante(data.tipoCbte) || 'X';
    doc.rect(left + width / 2 - 25, 40, 50, 50).stroke();
    doc.fontSize(28).text(letra, left + width / 2 - 25, 52, { width: 50, align: 'center' });
    doc.fontSize(7).text('COMPROBANTE', left + width / 2 - 45, 93, {
      width: 90,
      align: 'center',
    });

    doc.fontSize(16).text(data.emisor.razonSocial, left, 45);
    doc.fontSize(9).text(`CUIT: ${data.emisor.cuit}`, left, 68);
    doc.text(`Condición IVA: ${data.emisor.condicionIva}`, left);

    doc.fontSize(11).text(comprobanteId(data.tipoCbte, data.puntoVenta, data.numero), right - 220, 45, {
      width: 220,
      align: 'right',
    });
    doc.fontSize(9).text(`Fecha: ${fecha(data.fecha)}`, right - 220, 64, {
      width: 220,
      align: 'right',
    });

    doc.moveTo(left, 110).lineTo(right, 110).stroke();

    // Receptor.
    let y = 122;
    doc.fontSize(10).text('Receptor', left, y);
    y += 15;
    if (data.receptor) {
      const label = nombreTipoDocumento[data.receptor.tipoDoc] ?? `Doc ${data.receptor.tipoDoc}`;
      doc.fontSize(9).text(`${label}: ${data.receptor.nroDoc}`, left, y);
    } else {
      doc.fontSize(9).text('Consumidor Final', left, y);
    }
    y += 25;

    // Tabla de ítems.
    const cols = { desc: left, cant: left + 250, precio: left + 320, iva: left + 410, sub: right - 90 };
    doc.fontSize(9).fillColor('#000');
    doc.text('Descripción', cols.desc, y);
    doc.text('Cant.', cols.cant, y, { width: 50, align: 'right' });
    doc.text('P. Unit.', cols.precio, y, { width: 70, align: 'right' });
    doc.text('IVA %', cols.iva, y, { width: 50, align: 'right' });
    doc.text('Subtotal', cols.sub, y, { width: 90, align: 'right' });
    y += 14;
    doc.moveTo(left, y).lineTo(right, y).stroke();
    y += 6;

    for (const it of data.items) {
      doc.fontSize(8);
      const h = doc.heightOfString(it.descripcion, { width: 240 });
      doc.text(it.descripcion, cols.desc, y, { width: 240 });
      doc.text(money(it.cantidad), cols.cant, y, { width: 50, align: 'right' });
      doc.text(money(it.precioUnit), cols.precio, y, { width: 70, align: 'right' });
      doc.text(money(it.alicuotaIva), cols.iva, y, { width: 50, align: 'right' });
      doc.text(money(it.subtotal), cols.sub, y, { width: 90, align: 'right' });
      y += Math.max(h, 12) + 4;
    }

    doc.moveTo(left, y).lineTo(right, y).stroke();
    y += 10;

    // Totales.
    const totalLabel = (label: string, value: string, bold = false) => {
      doc.fontSize(bold ? 11 : 9).text(label, right - 260, y, { width: 170, align: 'right' });
      doc.text(value, right - 90, y, { width: 90, align: 'right' });
      y += bold ? 18 : 14;
    };
    totalLabel('Importe Neto:', `$ ${money(data.impNeto)}`);
    totalLabel('IVA:', `$ ${money(data.impIva)}`);
    totalLabel('Total:', `$ ${money(data.impTotal)}`, true);

    // Comprobantes asociados (NC/ND).
    if (data.comprobantesAsociados.length > 0) {
      y += 8;
      doc.fontSize(9).text('Comprobantes asociados:', left, y);
      y += 14;
      for (const c of data.comprobantesAsociados) {
        doc.fontSize(8).text(`• ${comprobanteId(c.tipo, c.puntoVenta, c.numero)}`, left + 10, y);
        y += 12;
      }
    }

    // Pie: QR + CAE.
    const qrY = doc.page.height - 180;
    doc.image(data.qrPng, left, qrY, { width: 120, height: 120 });
    doc.fontSize(10).text('CAE', left + 140, qrY + 20);
    doc.fontSize(12).text(data.cae, left + 140, qrY + 34);
    doc.fontSize(9).text(`Vencimiento CAE: ${fecha(data.caeVto)}`, left + 140, qrY + 56);
    doc.fontSize(7).fillColor('#666').text(
      'Comprobante autorizado por ARCA. Verificable con el código QR.',
      left + 140,
      qrY + 76,
      { width: width - 140 },
    );

    doc.end();
  });
}
