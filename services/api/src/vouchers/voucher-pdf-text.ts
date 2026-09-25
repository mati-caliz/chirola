import { hasText, TaxTreatment, voucherTypeName } from "@chirola/shared";
import type { FiscalTransparencyPdf, IssuerPdf, PdfItem } from "./voucher-pdf.types";

const SALES_POINT_DIGITS = 5;
const VOUCHER_NUMBER_DIGITS = 8;
const DATE_PART_DIGITS = 2;

const FISCAL_TRANSPARENCY_TITLE = "Régimen de Transparencia Fiscal al Consumidor (Ley 27.743)";

export const money = (count: number): string =>
  count.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const datePart = (value: number): string => String(value).padStart(DATE_PART_DIGITS, "0");

export const formatDate = (value: Date): string =>
  `${datePart(value.getDate())}/${datePart(value.getMonth() + 1)}/${value.getFullYear()}`;

export const ivaCell = (item: PdfItem): string => {
  if (item.taxTreatment === TaxTreatment.EXEMPT) return "Exento";
  if (item.taxTreatment === TaxTreatment.UNTAXED) return "No grav.";
  return money(item.ivaRate);
};

export const issuerDetailLines = (issuer: IssuerPdf): string[] => [
  ...(hasText(issuer.commercialAddress) ? [`Domicilio comercial: ${issuer.commercialAddress}`] : []),
  `CUIT: ${issuer.cuit}`,
  `Condición IVA: ${issuer.ivaCondition}`,
];

export const fiscalTransparencyLines = (transparency: FiscalTransparencyPdf): [string, ...string[]] => [
  FISCAL_TRANSPARENCY_TITLE,
  `IVA Contenido: $ ${money(transparency.containedIva)}`,
  `Otros Impuestos Nacionales Indirectos: $ ${money(transparency.otherNationalIndirectTaxes)}`,
];

const voucherTypeLabel = (type: number): string => voucherTypeName[type] ?? `Tipo ${type}`;

export const describeVoucher = (type: number, salesPoint: number, number: number): string => {
  const paddedSalesPoint = String(salesPoint).padStart(SALES_POINT_DIGITS, "0");
  const paddedNumber = String(number).padStart(VOUCHER_NUMBER_DIGITS, "0");
  return `${voucherTypeLabel(type)} ${paddedSalesPoint}-${paddedNumber}`;
};
