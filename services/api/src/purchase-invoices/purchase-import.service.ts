import { BadRequestException, Injectable } from '@nestjs/common';
import { ivaRates, purchaseInvoiceTotal } from '@chirola/shared';
import { PrismaService } from '../prisma/prisma.service';
import {
  CsvFormatError,
  parseMisComprobantesCsv,
  type InvalidPurchaseRow,
  type ParsedPurchaseRow,
} from './mis-comprobantes-csv';

export const ImportRowStatus = {
  IMPORTABLE: 'IMPORTABLE',
  DUPLICATE: 'DUPLICATE',
  NEEDS_REVIEW: 'NEEDS_REVIEW',
} as const;

export type ImportRowStatusName =
  (typeof ImportRowStatus)[keyof typeof ImportRowStatus];

export interface ClassifiedRow {
  line: number;
  supplierCuit: string;
  supplierName: string;
  invoiceType: number;
  salesPoint: number;
  number: number;
  issueDate: string;
  total: number;
  ivaRate: number | null;
  status: ImportRowStatusName;
  reason?: string;
}

export interface ImportPreview {
  rows: ClassifiedRow[];
  invalid: InvalidPurchaseRow[];
  summary: {
    importable: number;
    duplicates: number;
    needsReview: number;
    invalid: number;
  };
}

const RATE_TOLERANCE = 0.005;
const AMOUNT_TOLERANCE = 0.01;
const NO_IVA_RATE = 0;

function inferIvaRate(row: ParsedPurchaseRow): number | null {
  if (row.ivaAmount === 0) {
    return row.netTaxed === 0 ? NO_IVA_RATE : null;
  }
  if (row.netTaxed === 0) return null;

  const ratio = row.ivaAmount / row.netTaxed;
  const match = ivaRates.find(
    (rate) => rate > 0 && Math.abs(ratio - rate / 100) < RATE_TOLERANCE,
  );
  return match ?? null;
}

function amountsForRate(row: ParsedPurchaseRow, ivaRate: number) {
  const taxed = { netAmount21: 0, iva21: 0, netAmount105: 0, iva105: 0, netAmount27: 0, iva27: 0 };
  if (ivaRate === 21) {
    taxed.netAmount21 = row.netTaxed;
    taxed.iva21 = row.ivaAmount;
  } else if (ivaRate === 10.5) {
    taxed.netAmount105 = row.netTaxed;
    taxed.iva105 = row.ivaAmount;
  } else if (ivaRate === 27) {
    taxed.netAmount27 = row.netTaxed;
    taxed.iva27 = row.ivaAmount;
  }
  return { ...taxed, exempt: row.exempt, untaxed: row.untaxed };
}

@Injectable()
export class PurchaseImportService {
  constructor(private readonly prisma: PrismaService) {}

  async preview(issuerId: string, csv: string): Promise<ImportPreview> {
    const { rows, invalid } = this.parse(csv);
    const existing = await this.findExistingKeys(issuerId, rows);
    const classified = rows.map((row) => this.classify(row, existing));
    return this.summarize(classified, invalid);
  }

  async import(issuerId: string, csv: string): Promise<ImportPreview> {
    const { rows, invalid } = this.parse(csv);
    const existing = await this.findExistingKeys(issuerId, rows);
    const classified = rows.map((row) => this.classify(row, existing));

    for (const [index, row] of rows.entries()) {
      if (classified[index].status !== ImportRowStatus.IMPORTABLE) continue;
      const ivaRate = classified[index].ivaRate ?? NO_IVA_RATE;
      const amounts = amountsForRate(row, ivaRate);
      await this.prisma.purchaseInvoice.create({
        data: {
          issuerId,
          supplierCuit: row.supplierCuit,
          supplierName: row.supplierName,
          invoiceType: row.invoiceType,
          salesPoint: row.salesPoint,
          number: row.number,
          issueDate: new Date(row.issueDate),
          ...amounts,
          total: purchaseInvoiceTotal(amounts),
        },
      });
    }

    return this.summarize(classified, invalid);
  }

  private parse(csv: string) {
    try {
      return parseMisComprobantesCsv(csv);
    } catch (err) {
      if (err instanceof CsvFormatError) {
        throw new BadRequestException(err.message);
      }
      throw err;
    }
  }

  private rowKey(row: {
    supplierCuit: string;
    invoiceType: number;
    salesPoint: number;
    number: number;
  }): string {
    return `${row.supplierCuit}|${row.invoiceType}|${row.salesPoint}|${row.number}`;
  }

  private async findExistingKeys(
    issuerId: string,
    rows: ParsedPurchaseRow[],
  ): Promise<Set<string>> {
    if (rows.length === 0) return new Set();
    const stored = await this.prisma.purchaseInvoice.findMany({
      where: {
        issuerId,
        supplierCuit: { in: [...new Set(rows.map((row) => row.supplierCuit))] },
      },
      select: {
        supplierCuit: true,
        invoiceType: true,
        salesPoint: true,
        number: true,
      },
    });
    return new Set(stored.map((invoice) => this.rowKey(invoice)));
  }

  private classify(
    row: ParsedPurchaseRow,
    existing: Set<string>,
  ): ClassifiedRow {
    const ivaRate = inferIvaRate(row);
    const base = {
      line: row.line,
      supplierCuit: row.supplierCuit,
      supplierName: row.supplierName,
      invoiceType: row.invoiceType,
      salesPoint: row.salesPoint,
      number: row.number,
      issueDate: row.issueDate,
      total: row.total,
      ivaRate,
    };

    if (existing.has(this.rowKey(row))) {
      return { ...base, status: ImportRowStatus.DUPLICATE };
    }
    if (ivaRate === null) {
      return {
        ...base,
        status: ImportRowStatus.NEEDS_REVIEW,
        reason:
          'El IVA no corresponde a una sola alícuota; cargalo a mano indicando el desglose.',
      };
    }
    const rebuiltTotal = purchaseInvoiceTotal(amountsForRate(row, ivaRate));
    if (Math.abs(rebuiltTotal - row.total) > AMOUNT_TOLERANCE) {
      return {
        ...base,
        status: ImportRowStatus.NEEDS_REVIEW,
        reason: `El total del archivo (${row.total}) no coincide con la suma de los importes (${rebuiltTotal}); puede tener otros tributos, que no se importan.`,
      };
    }
    return { ...base, status: ImportRowStatus.IMPORTABLE };
  }

  private summarize(
    rows: ClassifiedRow[],
    invalid: InvalidPurchaseRow[],
  ): ImportPreview {
    const countOf = (status: ImportRowStatusName): number =>
      rows.filter((row) => row.status === status).length;
    return {
      rows,
      invalid,
      summary: {
        importable: countOf(ImportRowStatus.IMPORTABLE),
        duplicates: countOf(ImportRowStatus.DUPLICATE),
        needsReview: countOf(ImportRowStatus.NEEDS_REVIEW),
        invalid: invalid.length,
      },
    };
  }
}
