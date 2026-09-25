import { documentTypeName, requiresRetentionNotice, voucherLetter } from "@chirola/shared";
import {
  describeVoucher,
  fiscalTransparencyLines,
  formatDate,
  issuerDetailLines,
  ivaCell,
  money,
} from "./voucher-pdf-text";
import type {
  AssociatedVoucherPdf,
  FiscalTransparencyPdf,
  PdfFrame,
  PdfItem,
  VoucherPdfData,
} from "./voucher-pdf.types";

const UNKNOWN_LETTER = "X";
const LETTER_BOX_TOP = 40;
const LETTER_BOX_SIZE = 50;
const LETTER_FONT_SIZE = 28;
const LETTER_TOP = 52;
const LETTER_CAPTION_FONT_SIZE = 7;
const LETTER_CAPTION_WIDTH = 90;
const LETTER_CAPTION_TOP = 93;

const ISSUER_NAME_FONT_SIZE = 16;
const ISSUER_NAME_TOP = 45;
const ISSUER_DETAILS_FONT_SIZE = 9;
const ISSUER_DETAILS_TOP = 66;
const ISSUER_DETAILS_GAP_TO_LETTER_BOX = 35;

const HEADING_WIDTH = 220;
const HEADING_TITLE_FONT_SIZE = 11;
const HEADING_TITLE_TOP = 45;
const HEADING_DATE_FONT_SIZE = 9;
const HEADING_DATE_TOP = 64;
const HEADING_NOTE_FONT_SIZE = 8;
const SERVICE_PERIOD_TOP = 78;
const PAYMENT_DUE_DATE_TOP = 90;
const HEADER_RULE_TOP = 110;

const RECIPIENT_TOP = 122;
const RECIPIENT_TITLE_FONT_SIZE = 10;
const RECIPIENT_TITLE_HEIGHT = 15;
const RECIPIENT_FONT_SIZE = 9;
const RECIPIENT_HEIGHT = 25;

const TABLE_FONT_SIZE = 9;
const TABLE_TEXT_COLOR = "#000";
const QUANTITY_COLUMN_OFFSET = 250;
const UNIT_PRICE_COLUMN_OFFSET = 320;
const IVA_COLUMN_OFFSET = 410;
const SUBTOTAL_COLUMN_WIDTH = 90;
const QUANTITY_COLUMN_WIDTH = 50;
const UNIT_PRICE_COLUMN_WIDTH = 70;
const IVA_COLUMN_WIDTH = 50;
const TABLE_HEADER_HEIGHT = 14;
const TABLE_HEADER_GAP = 6;
const ITEM_FONT_SIZE = 8;
const ITEM_DESCRIPTION_WIDTH = 240;
const ITEM_MIN_HEIGHT = 12;
const ITEM_GAP = 4;
const TABLE_BOTTOM_GAP = 10;

const TOTAL_LABEL_OFFSET = 260;
const TOTAL_LABEL_WIDTH = 170;
const TOTAL_VALUE_WIDTH = 90;
const TOTAL_FONT_SIZE = 9;
const GRAND_TOTAL_FONT_SIZE = 11;
const TOTAL_HEIGHT = 14;
const GRAND_TOTAL_HEIGHT = 18;

const ASSOCIATED_GAP = 8;
const ASSOCIATED_TITLE_FONT_SIZE = 9;
const ASSOCIATED_TITLE_HEIGHT = 14;
const ASSOCIATED_FONT_SIZE = 8;
const ASSOCIATED_INDENT = 10;
const ASSOCIATED_HEIGHT = 12;

const NOTICE_GAP = 12;
const NOTICE_FONT_SIZE = 8;
const TRANSPARENCY_TITLE_HEIGHT = 12;
const TRANSPARENCY_LINE_HEIGHT = 11;

const RETENTION_NOTICE =
  "COMPROBANTE SUJETO A RETENCIÓN — El receptor actúa como agente de retención de IVA y Ganancias (RG 1575).";

const FOOTER_OFFSET_FROM_BOTTOM = 180;
const QR_SIZE = 120;
const CAE_COLUMN_OFFSET = 140;
const CAE_LABEL_FONT_SIZE = 10;
const CAE_LABEL_OFFSET = 20;
const CAE_FONT_SIZE = 12;
const CAE_OFFSET = 34;
const CAE_EXPIRATION_FONT_SIZE = 9;
const CAE_EXPIRATION_OFFSET = 56;
const CAE_DISCLAIMER_FONT_SIZE = 7;
const CAE_DISCLAIMER_COLOR = "#666";
const CAE_DISCLAIMER_OFFSET = 76;
const CAE_DISCLAIMER = "Comprobante autorizado por ARCA. Verificable con el código QR.";

export function drawLetterBox({ doc, left, width }: PdfFrame, voucherType: number): void {
  const center = left + width / 2;
  const letterBoxLeft = center - LETTER_BOX_SIZE / 2;
  const letter = voucherLetter(voucherType) || UNKNOWN_LETTER;
  doc.rect(letterBoxLeft, LETTER_BOX_TOP, LETTER_BOX_SIZE, LETTER_BOX_SIZE).stroke();
  doc.fontSize(LETTER_FONT_SIZE).text(letter, letterBoxLeft, LETTER_TOP, {
    width: LETTER_BOX_SIZE,
    align: "center",
  });
  doc
    .fontSize(LETTER_CAPTION_FONT_SIZE)
    .text("COMPROBANTE", center - LETTER_CAPTION_WIDTH / 2, LETTER_CAPTION_TOP, {
      width: LETTER_CAPTION_WIDTH,
      align: "center",
    });
}

export function drawIssuer({ doc, left, width }: PdfFrame, issuer: VoucherPdfData["issuer"]): void {
  doc.fontSize(ISSUER_NAME_FONT_SIZE).text(issuer.legalName, left, ISSUER_NAME_TOP);
  doc.fontSize(ISSUER_DETAILS_FONT_SIZE);
  for (const [index, line] of issuerDetailLines(issuer).entries()) {
    doc.text(line, left, index === 0 ? ISSUER_DETAILS_TOP : undefined, {
      width: width / 2 - ISSUER_DETAILS_GAP_TO_LETTER_BOX,
    });
  }
}

function drawHeadingLine(frame: PdfFrame, text: string, top: number): void {
  frame.doc.text(text, frame.right - HEADING_WIDTH, top, { width: HEADING_WIDTH, align: "right" });
}

export function drawHeading(frame: PdfFrame, data: VoucherPdfData): void {
  const { doc } = frame;
  doc.fontSize(HEADING_TITLE_FONT_SIZE);
  drawHeadingLine(frame, describeVoucher(data.voucherType, data.salesPoint, data.number), HEADING_TITLE_TOP);
  doc.fontSize(HEADING_DATE_FONT_SIZE);
  drawHeadingLine(frame, `Fecha: ${formatDate(data.date)}`, HEADING_DATE_TOP);

  if (data.servicePeriod !== null) {
    const { from, to } = data.servicePeriod;
    doc.fontSize(HEADING_NOTE_FONT_SIZE);
    drawHeadingLine(frame, `Período facturado: ${formatDate(from)} al ${formatDate(to)}`, SERVICE_PERIOD_TOP);
  }

  if (data.paymentDueDate !== null) {
    doc.fontSize(HEADING_NOTE_FONT_SIZE);
    drawHeadingLine(frame, `Vencimiento de pago: ${formatDate(data.paymentDueDate)}`, PAYMENT_DUE_DATE_TOP);
  }

  drawRule(frame, HEADER_RULE_TOP);
}

function drawRule({ doc, left, right }: PdfFrame, top: number): void {
  doc.moveTo(left, top).lineTo(right, top).stroke();
}

export function drawRecipient({ doc, left }: PdfFrame, recipient: VoucherPdfData["recipient"]): number {
  let top = RECIPIENT_TOP;
  doc.fontSize(RECIPIENT_TITLE_FONT_SIZE).text("Receptor", left, top);
  top += RECIPIENT_TITLE_HEIGHT;
  if (recipient === null) {
    doc.fontSize(RECIPIENT_FONT_SIZE).text("Consumidor Final", left, top);
  } else {
    const label = documentTypeName[recipient.docType] ?? `Doc ${recipient.docType}`;
    doc.fontSize(RECIPIENT_FONT_SIZE).text(`${label}: ${recipient.docNumber}`, left, top);
  }
  return top + RECIPIENT_HEIGHT;
}

interface TableColumns {
  description: number;
  quantity: number;
  unitPrice: number;
  iva: number;
  subtotal: number;
}

function tableColumns({ left, right }: PdfFrame): TableColumns {
  return {
    description: left,
    quantity: left + QUANTITY_COLUMN_OFFSET,
    unitPrice: left + UNIT_PRICE_COLUMN_OFFSET,
    iva: left + IVA_COLUMN_OFFSET,
    subtotal: right - SUBTOTAL_COLUMN_WIDTH,
  };
}

interface TableRow {
  quantity: string;
  unitPrice: string;
  iva: string;
  subtotal: string;
}

function drawNumericCells(doc: PDFKit.PDFDocument, columns: TableColumns, row: TableRow, top: number): void {
  doc.text(row.quantity, columns.quantity, top, { width: QUANTITY_COLUMN_WIDTH, align: "right" });
  doc.text(row.unitPrice, columns.unitPrice, top, { width: UNIT_PRICE_COLUMN_WIDTH, align: "right" });
  doc.text(row.iva, columns.iva, top, { width: IVA_COLUMN_WIDTH, align: "right" });
  doc.text(row.subtotal, columns.subtotal, top, { width: SUBTOTAL_COLUMN_WIDTH, align: "right" });
}

function drawItem(doc: PDFKit.PDFDocument, columns: TableColumns, item: PdfItem, top: number): number {
  doc.fontSize(ITEM_FONT_SIZE);
  const descriptionHeight = doc.heightOfString(item.description, { width: ITEM_DESCRIPTION_WIDTH });
  doc.text(item.description, columns.description, top, { width: ITEM_DESCRIPTION_WIDTH });
  drawNumericCells(
    doc,
    columns,
    {
      quantity: money(item.quantity),
      unitPrice: money(item.unitPrice),
      iva: ivaCell(item),
      subtotal: money(item.subtotal),
    },
    top,
  );
  return top + Math.max(descriptionHeight, ITEM_MIN_HEIGHT) + ITEM_GAP;
}

export function drawItemsTable(frame: PdfFrame, items: PdfItem[], tableTop: number): number {
  const { doc } = frame;
  const columns = tableColumns(frame);
  let top = tableTop;
  doc.fontSize(TABLE_FONT_SIZE).fillColor(TABLE_TEXT_COLOR);
  doc.text("Descripción", columns.description, top);
  drawNumericCells(
    doc,
    columns,
    { quantity: "Cant.", unitPrice: "P. Unit.", iva: "IVA %", subtotal: "Subtotal" },
    top,
  );
  top += TABLE_HEADER_HEIGHT;
  drawRule(frame, top);
  top += TABLE_HEADER_GAP;

  for (const item of items) {
    top = drawItem(doc, columns, item, top);
  }

  drawRule(frame, top);
  return top + TABLE_BOTTOM_GAP;
}

function drawTotalLine(
  { doc, right }: PdfFrame,
  line: { label: string; amount: number; grandTotal?: boolean },
  top: number,
): number {
  const grandTotal = line.grandTotal === true;
  doc
    .fontSize(grandTotal ? GRAND_TOTAL_FONT_SIZE : TOTAL_FONT_SIZE)
    .text(line.label, right - TOTAL_LABEL_OFFSET, top, { width: TOTAL_LABEL_WIDTH, align: "right" });
  doc.text(`$ ${money(line.amount)}`, right - TOTAL_VALUE_WIDTH, top, {
    width: TOTAL_VALUE_WIDTH,
    align: "right",
  });
  return top + (grandTotal ? GRAND_TOTAL_HEIGHT : TOTAL_HEIGHT);
}

function totalLines(data: VoucherPdfData): { label: string; amount: number; grandTotal?: boolean }[] {
  return [
    { label: "Importe Neto:", amount: data.netAmount },
    ...(data.untaxedAmount > 0 ? [{ label: "Importe No Gravado:", amount: data.untaxedAmount }] : []),
    ...(data.exemptAmount > 0 ? [{ label: "Importe Exento:", amount: data.exemptAmount }] : []),
    { label: "IVA:", amount: data.ivaAmount },
    ...data.tributes.map((tribute) => ({ label: `${tribute.description}:`, amount: tribute.amount })),
    { label: "Total:", amount: data.totalAmount, grandTotal: true },
  ];
}

export function drawTotals(frame: PdfFrame, data: VoucherPdfData, totalsTop: number): number {
  let top = totalsTop;
  for (const line of totalLines(data)) {
    top = drawTotalLine(frame, line, top);
  }
  return top;
}

export function drawAssociatedVouchers(
  { doc, left }: PdfFrame,
  vouchers: AssociatedVoucherPdf[],
  sectionTop: number,
): number {
  if (vouchers.length === 0) {
    return sectionTop;
  }
  let top = sectionTop + ASSOCIATED_GAP;
  doc.fontSize(ASSOCIATED_TITLE_FONT_SIZE).text("Comprobantes asociados:", left, top);
  top += ASSOCIATED_TITLE_HEIGHT;
  for (const voucher of vouchers) {
    const description = describeVoucher(voucher.type, voucher.salesPoint, voucher.number);
    doc.fontSize(ASSOCIATED_FONT_SIZE).text(`• ${description}`, left + ASSOCIATED_INDENT, top);
    top += ASSOCIATED_HEIGHT;
  }
  return top;
}

export function drawFiscalTransparency(
  { doc, left, width }: PdfFrame,
  transparency: FiscalTransparencyPdf | null,
  sectionTop: number,
): number {
  if (transparency === null) {
    return sectionTop;
  }
  let top = sectionTop + NOTICE_GAP;
  const [title, ...details] = fiscalTransparencyLines(transparency);
  doc.fontSize(NOTICE_FONT_SIZE).text(title, left, top, { width, underline: true });
  top += TRANSPARENCY_TITLE_HEIGHT;
  for (const detail of details) {
    doc.fontSize(NOTICE_FONT_SIZE).text(detail, left, top, { width });
    top += TRANSPARENCY_LINE_HEIGHT;
  }
  return top;
}

export function drawRetentionNotice({ doc, left, width }: PdfFrame, voucherType: number, top: number): void {
  if (!requiresRetentionNotice(voucherType)) {
    return;
  }
  doc.fontSize(NOTICE_FONT_SIZE).text(RETENTION_NOTICE, left, top + NOTICE_GAP, { width });
}

export function drawCaeFooter({ doc, left, width }: PdfFrame, data: VoucherPdfData): void {
  const qrTop = doc.page.height - FOOTER_OFFSET_FROM_BOTTOM;
  const caeLeft = left + CAE_COLUMN_OFFSET;
  doc.image(data.qrPng, left, qrTop, { width: QR_SIZE, height: QR_SIZE });
  doc.fontSize(CAE_LABEL_FONT_SIZE).text("CAE", caeLeft, qrTop + CAE_LABEL_OFFSET);
  doc.fontSize(CAE_FONT_SIZE).text(data.cae, caeLeft, qrTop + CAE_OFFSET);
  doc
    .fontSize(CAE_EXPIRATION_FONT_SIZE)
    .text(`Vencimiento CAE: ${formatDate(data.caeExpiration)}`, caeLeft, qrTop + CAE_EXPIRATION_OFFSET);
  doc
    .fontSize(CAE_DISCLAIMER_FONT_SIZE)
    .fillColor(CAE_DISCLAIMER_COLOR)
    .text(CAE_DISCLAIMER, caeLeft, qrTop + CAE_DISCLAIMER_OFFSET, { width: width - CAE_COLUMN_OFFSET });
}
