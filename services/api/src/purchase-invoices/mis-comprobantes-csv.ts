const BOM = '﻿';
const SEMICOLON = ';';
const COMMA = ',';

export const CsvColumn = {
  DATE: 'fecha',
  TYPE: 'tipo',
  SALES_POINT: 'puntodeventa',
  NUMBER_FROM: 'numerodesde',
  ISSUER_DOC_NUMBER: 'nrodocemisor',
  ISSUER_NAME: 'denominacionemisor',
  NET_TAXED: 'impnetogravado',
  NET_UNTAXED: 'impnetonogravado',
  EXEMPT: 'impopexentas',
  IVA: 'iva',
  TOTAL: 'imptotal',
} as const;

const REQUIRED_COLUMNS: readonly string[] = Object.values(CsvColumn);

export interface ParsedPurchaseRow {
  line: number;
  supplierCuit: string;
  supplierName: string;
  invoiceType: number;
  salesPoint: number;
  number: number;
  issueDate: string;
  netTaxed: number;
  untaxed: number;
  exempt: number;
  ivaAmount: number;
  total: number;
}

export interface InvalidPurchaseRow {
  line: number;
  reason: string;
}

export interface ParsedCsv {
  rows: ParsedPurchaseRow[];
  invalid: InvalidPurchaseRow[];
}

export class CsvFormatError extends Error {}

function normalizeHeader(header: string): string {
  return header
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function detectDelimiter(headerLine: string): string {
  const semicolons = headerLine.split(SEMICOLON).length;
  const commas = headerLine.split(COMMA).length;
  return semicolons >= commas ? SEMICOLON : COMMA;
}

function splitLine(line: string, delimiter: string): string[] {
  const fields: string[] = [];
  let current = '';
  let quoted = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === delimiter && !quoted) {
      fields.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  fields.push(current.trim());
  return fields;
}

export function parseArcaAmount(raw: string): number {
  const cleaned = raw.replace(/\s/g, '');
  if (cleaned === '') return 0;
  const usesCommaDecimals = /,\d{1,2}$/.test(cleaned);
  const normalized = usesCommaDecimals
    ? cleaned.replace(/\./g, '').replace(',', '.')
    : cleaned.replace(/,/g, '');
  const value = Number(normalized);
  if (!Number.isFinite(value)) {
    throw new CsvFormatError(`Importe ilegible: "${raw}".`);
  }
  return value;
}

export function parseArcaDate(raw: string): string {
  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;

  const localMatch = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (localMatch) return `${localMatch[3]}-${localMatch[2]}-${localMatch[1]}`;

  throw new CsvFormatError(`Fecha ilegible: "${raw}".`);
}

function parseInteger(raw: string, label: string): number {
  const value = Number(raw.replace(/\D/g, ''));
  if (!Number.isFinite(value) || value === 0) {
    throw new CsvFormatError(`${label} ilegible: "${raw}".`);
  }
  return value;
}

function parseCuit(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length !== 11) {
    throw new CsvFormatError(`CUIT del emisor inválido: "${raw}".`);
  }
  return digits;
}

export function parseMisComprobantesCsv(csv: string): ParsedCsv {
  const lines = csv
    .replace(BOM, '')
    .split(/\r?\n/)
    .filter((line) => line.trim() !== '');

  if (lines.length === 0) {
    throw new CsvFormatError('El archivo está vacío.');
  }

  const delimiter = detectDelimiter(lines[0]);
  const headers = splitLine(lines[0], delimiter).map(normalizeHeader);
  const missing = REQUIRED_COLUMNS.filter(
    (column) => !headers.includes(column),
  );
  if (missing.length > 0) {
    throw new CsvFormatError(
      `Al archivo le faltan columnas de Mis Comprobantes: ${missing.join(', ')}.`,
    );
  }

  const columnIndex = (column: string): number => headers.indexOf(column);

  const rows: ParsedPurchaseRow[] = [];
  const invalid: InvalidPurchaseRow[] = [];

  for (let i = 1; i < lines.length; i += 1) {
    const fields = splitLine(lines[i], delimiter);
    const at = (column: string): string => fields[columnIndex(column)] ?? '';
    const line = i + 1;
    try {
      rows.push({
        line,
        supplierCuit: parseCuit(at(CsvColumn.ISSUER_DOC_NUMBER)),
        supplierName: at(CsvColumn.ISSUER_NAME),
        invoiceType: parseInteger(at(CsvColumn.TYPE), 'Tipo de comprobante'),
        salesPoint: parseInteger(at(CsvColumn.SALES_POINT), 'Punto de venta'),
        number: parseInteger(at(CsvColumn.NUMBER_FROM), 'Número'),
        issueDate: parseArcaDate(at(CsvColumn.DATE)),
        netTaxed: parseArcaAmount(at(CsvColumn.NET_TAXED)),
        untaxed: parseArcaAmount(at(CsvColumn.NET_UNTAXED)),
        exempt: parseArcaAmount(at(CsvColumn.EXEMPT)),
        ivaAmount: parseArcaAmount(at(CsvColumn.IVA)),
        total: parseArcaAmount(at(CsvColumn.TOTAL)),
      });
    } catch (err) {
      invalid.push({
        line,
        reason: err instanceof CsvFormatError ? err.message : String(err),
      });
    }
  }

  return { rows, invalid };
}
