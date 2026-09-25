import PDFDocument from "pdfkit";
import {
  drawAssociatedVouchers,
  drawCaeFooter,
  drawFiscalTransparency,
  drawHeading,
  drawIssuer,
  drawItemsTable,
  drawLetterBox,
  drawRecipient,
  drawRetentionNotice,
  drawTotals,
} from "./voucher-pdf-sections";
import type { PdfFrame, VoucherPdfData } from "./voucher-pdf.types";

export type {
  AssociatedVoucherPdf,
  FiscalTransparencyPdf,
  IssuerPdf,
  PdfItem,
  ServicePeriodPdf,
  TributePdf,
  VoucherPdfData,
} from "./voucher-pdf.types";
export { describeVoucher, fiscalTransparencyLines, issuerDetailLines } from "./voucher-pdf-text";

const PAGE_MARGIN = 40;

function frameOf(doc: PDFKit.PDFDocument): PdfFrame {
  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  return { doc, left, right, width: right - left };
}

function drawVoucher(frame: PdfFrame, data: VoucherPdfData): void {
  drawLetterBox(frame, data.voucherType);
  drawIssuer(frame, data.issuer);
  drawHeading(frame, data);
  const tableTop = drawRecipient(frame, data.recipient);
  const totalsTop = drawItemsTable(frame, data.items, tableTop);
  const associatedTop = drawTotals(frame, data, totalsTop);
  const transparencyTop = drawAssociatedVouchers(frame, data.associatedVouchers, associatedTop);
  const retentionTop = drawFiscalTransparency(frame, data.fiscalTransparency, transparencyTop);
  drawRetentionNotice(frame, data.voucherType, retentionTop);
  drawCaeFooter(frame, data);
}

export function renderVoucherPdf(data: VoucherPdfData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: PAGE_MARGIN });
    const chunks: Buffer[] = [];
    doc.on("data", (buffer: Buffer) => chunks.push(buffer));
    doc.on("end", () => {
      resolve(Buffer.concat(chunks));
    });
    doc.on("error", reject);

    drawVoucher(frameOf(doc), data);

    doc.end();
  });
}
