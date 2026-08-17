import PDFDocument from 'pdfkit';
import {
  voucherLetter,
  voucherTypeName,
  documentTypeName,
  TaxTreatment,
  type TaxTreatmentType,
} from '@chirola/shared';

export interface PdfItem {
  description: string;
  quantity: number;
  unitPrice: number;
  ivaRate: number;
  taxTreatment: TaxTreatmentType;
  subtotal: number;
}

export interface AssociatedVoucherPdf {
  type: number;
  salesPoint: number;
  number: number;
}

export interface TributePdf {
  description: string;
  amount: number;
}

export interface ServicePeriodPdf {
  from: Date;
  to: Date;
  paymentDueDate: Date;
}

export interface VoucherPdfData {
  issuer: { legalName: string; cuit: string; ivaCondition: string };
  recipient: { docType: number; docNumber: string } | null;
  voucherType: number;
  salesPoint: number;
  number: number;
  date: Date;
  currency: string;
  netAmount: number;
  ivaAmount: number;
  exemptAmount: number;
  untaxedAmount: number;
  totalAmount: number;
  tributes: TributePdf[];
  cae: string;
  caeExpiration: Date;
  items: PdfItem[];
  associatedVouchers: AssociatedVoucherPdf[];
  servicePeriod: ServicePeriodPdf | null;
  qrPng: Buffer;
}

const money = (n: number): string =>
  n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const date = (d: Date): string =>
  `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;

const ivaCell = (item: PdfItem): string => {
  if (item.taxTreatment === TaxTreatment.EXEMPT) return 'Exento';
  if (item.taxTreatment === TaxTreatment.UNTAXED) return 'No grav.';
  return money(item.ivaRate);
};

const voucherId = (type: number, salesPoint: number, number: number): string =>
  `${voucherTypeName[type] ?? `Tipo ${type}`} ${String(salesPoint).padStart(5, '0')}-${String(number).padStart(8, '0')}`;

export function renderVoucherPdf(data: VoucherPdfData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const left = doc.page.margins.left;
    const right = doc.page.width - doc.page.margins.right;
    const width = right - left;

    const letter = voucherLetter(data.voucherType) || 'X';
    doc.rect(left + width / 2 - 25, 40, 50, 50).stroke();
    doc.fontSize(28).text(letter, left + width / 2 - 25, 52, { width: 50, align: 'center' });
    doc.fontSize(7).text('COMPROBANTE', left + width / 2 - 45, 93, {
      width: 90,
      align: 'center',
    });

    doc.fontSize(16).text(data.issuer.legalName, left, 45);
    doc.fontSize(9).text(`CUIT: ${data.issuer.cuit}`, left, 68);
    doc.text(`Condición IVA: ${data.issuer.ivaCondition}`, left);

    doc.fontSize(11).text(voucherId(data.voucherType, data.salesPoint, data.number), right - 220, 45, {
      width: 220,
      align: 'right',
    });
    doc.fontSize(9).text(`Fecha: ${date(data.date)}`, right - 220, 64, {
      width: 220,
      align: 'right',
    });

    if (data.servicePeriod) {
      doc.fontSize(8).text(
        `Período facturado: ${date(data.servicePeriod.from)} al ${date(data.servicePeriod.to)}`,
        right - 220,
        78,
        { width: 220, align: 'right' },
      );
      doc.text(
        `Vencimiento de pago: ${date(data.servicePeriod.paymentDueDate)}`,
        right - 220,
        90,
        { width: 220, align: 'right' },
      );
    }

    doc.moveTo(left, 110).lineTo(right, 110).stroke();

    let y = 122;
    doc.fontSize(10).text('Receptor', left, y);
    y += 15;
    if (data.recipient) {
      const label = documentTypeName[data.recipient.docType] ?? `Doc ${data.recipient.docType}`;
      doc.fontSize(9).text(`${label}: ${data.recipient.docNumber}`, left, y);
    } else {
      doc.fontSize(9).text('Consumidor Final', left, y);
    }
    y += 25;

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
      const h = doc.heightOfString(it.description, { width: 240 });
      doc.text(it.description, cols.desc, y, { width: 240 });
      doc.text(money(it.quantity), cols.cant, y, { width: 50, align: 'right' });
      doc.text(money(it.unitPrice), cols.precio, y, { width: 70, align: 'right' });
      doc.text(ivaCell(it), cols.iva, y, { width: 50, align: 'right' });
      doc.text(money(it.subtotal), cols.sub, y, { width: 90, align: 'right' });
      y += Math.max(h, 12) + 4;
    }

    doc.moveTo(left, y).lineTo(right, y).stroke();
    y += 10;

    const totalLabel = (label: string, value: string, bold = false) => {
      doc.fontSize(bold ? 11 : 9).text(label, right - 260, y, { width: 170, align: 'right' });
      doc.text(value, right - 90, y, { width: 90, align: 'right' });
      y += bold ? 18 : 14;
    };
    totalLabel('Importe Neto:', `$ ${money(data.netAmount)}`);
    if (data.untaxedAmount > 0) {
      totalLabel('Importe No Gravado:', `$ ${money(data.untaxedAmount)}`);
    }
    if (data.exemptAmount > 0) {
      totalLabel('Importe Exento:', `$ ${money(data.exemptAmount)}`);
    }
    totalLabel('IVA:', `$ ${money(data.ivaAmount)}`);
    for (const tribute of data.tributes) {
      totalLabel(`${tribute.description}:`, `$ ${money(tribute.amount)}`);
    }
    totalLabel('Total:', `$ ${money(data.totalAmount)}`, true);

    if (data.associatedVouchers.length > 0) {
      y += 8;
      doc.fontSize(9).text('Comprobantes asociados:', left, y);
      y += 14;
      for (const voucher of data.associatedVouchers) {
        doc.fontSize(8).text(`• ${voucherId(voucher.type, voucher.salesPoint, voucher.number)}`, left + 10, y);
        y += 12;
      }
    }

    const qrY = doc.page.height - 180;
    doc.image(data.qrPng, left, qrY, { width: 120, height: 120 });
    doc.fontSize(10).text('CAE', left + 140, qrY + 20);
    doc.fontSize(12).text(data.cae, left + 140, qrY + 34);
    doc.fontSize(9).text(`Vencimiento CAE: ${date(data.caeExpiration)}`, left + 140, qrY + 56);
    doc.fontSize(7).fillColor('#666').text(
      'Comprobante autorizado por ARCA. Verificable con el código QR.',
      left + 140,
      qrY + 76,
      { width: width - 140 },
    );

    doc.end();
  });
}
