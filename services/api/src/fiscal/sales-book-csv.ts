import { documentTypeName, ivaRates, type SalesBook, type SalesBookEntry } from "@chirola/shared";

const COLUMN_SEPARATOR = ";";
const LINE_SEPARATOR = "\r\n";
const UTF8_BYTE_ORDER_MARK = "﻿";
const DECIMAL_PLACES = 2;
const SALES_POINT_DIGITS = 4;
const VOUCHER_NUMBER_DIGITS = 8;

const taxedRates = ivaRates.filter((rate) => rate > 0).sort((rateA, rateB) => rateB - rateA);

function formatAmount(amount: number): string {
  return amount.toFixed(DECIMAL_PLACES).replace(".", ",");
}

function formatDate(iso: string): string {
  const [year, month, day] = iso.slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
}

function quote(value: string): string {
  const needsQuoting = /[";\r\n]/.test(value);
  return needsQuoting ? `"${value.replace(/"/g, '""')}"` : value;
}

function ivaForRate(entry: SalesBookEntry, rate: number): number {
  return entry.ivaByRate.find((row) => row.rate === rate)?.amount ?? 0;
}

const header = [
  "Fecha",
  "Tipo",
  "Punto de venta",
  "Número",
  "Tipo doc. receptor",
  "Nro. doc. receptor",
  "Receptor",
  "Moneda",
  "Cotización",
  "Neto gravado",
  "No gravado",
  "Exento",
  ...taxedRates.map((rate) => `IVA ${String(rate).replace(".", ",")}%`),
  "IVA total",
  "Otros tributos",
  "Total",
  "CAE",
];

function toRow(entry: SalesBookEntry): string[] {
  return [
    formatDate(entry.voucherDate),
    entry.voucherTypeName,
    String(entry.salesPoint).padStart(SALES_POINT_DIGITS, "0"),
    String(entry.number).padStart(VOUCHER_NUMBER_DIGITS, "0"),
    entry.recipientDocType === null
      ? ""
      : (documentTypeName[entry.recipientDocType] ?? String(entry.recipientDocType)),
    entry.recipientDocNumber ?? "",
    entry.recipientName ?? "",
    entry.currency,
    String(entry.exchangeRate).replace(".", ","),
    formatAmount(entry.netAmount),
    formatAmount(entry.untaxedAmount),
    formatAmount(entry.exemptAmount),
    ...taxedRates.map((rate) => formatAmount(ivaForRate(entry, rate))),
    formatAmount(entry.ivaAmount),
    formatAmount(entry.tributeAmount),
    formatAmount(entry.totalAmount),
    entry.cae ?? "",
  ];
}

function toTotalsRow(book: SalesBook): string[] {
  const { totals } = book;
  const ivaTotalsByRate = taxedRates.map((rate) =>
    formatAmount(book.entries.reduce((total, entry) => total + ivaForRate(entry, rate), 0)),
  );
  return [
    "Totales",
    `${totals.voucherCount} comprobantes`,
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    formatAmount(totals.netAmount),
    formatAmount(totals.untaxedAmount),
    formatAmount(totals.exemptAmount),
    ...ivaTotalsByRate,
    formatAmount(totals.ivaAmount),
    formatAmount(totals.tributeAmount),
    formatAmount(totals.totalAmount),
    "",
  ];
}

export function renderSalesBookCsv(book: SalesBook): string {
  const rows = [header, ...book.entries.map(toRow), toTotalsRow(book)];
  const lines = rows.map((row) => row.map(quote).join(COLUMN_SEPARATOR));
  return UTF8_BYTE_ORDER_MARK + lines.join(LINE_SEPARATOR) + LINE_SEPARATOR;
}

export function salesBookFileName(book: SalesBook): string {
  return `libro-iva-ventas-${book.year}-${String(book.month).padStart(2, "0")}.csv`;
}
