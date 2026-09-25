import type { TaxTreatmentType } from "@chirola/shared";

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
}

export interface IssuerPdf {
  legalName: string;
  commercialAddress: string | null;
  cuit: string;
  ivaCondition: string;
}

export interface FiscalTransparencyPdf {
  containedIva: number;
  otherNationalIndirectTaxes: number;
}

export interface VoucherPdfData {
  issuer: IssuerPdf;
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
  paymentDueDate: Date | null;
  fiscalTransparency: FiscalTransparencyPdf | null;
  qrPng: Buffer;
}

export interface PdfFrame {
  doc: PDFKit.PDFDocument;
  left: number;
  right: number;
  width: number;
}
