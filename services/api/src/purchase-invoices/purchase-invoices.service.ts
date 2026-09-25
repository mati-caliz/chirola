import { Injectable, NotFoundException } from "@nestjs/common";
import {
  purchaseInvoiceTotal,
  type PurchaseInvoiceInput,
  type UpdatePurchaseInvoiceInput,
} from "@chirola/shared";
import { Prisma, type PurchaseInvoice } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { optionalField } from "../common/optional-field";
import { parseOptionalDate } from "../common/query-params";

interface Amounts {
  netAmount21: number;
  iva21: number;
  netAmount105: number;
  iva105: number;
  netAmount27: number;
  iva27: number;
  exempt: number;
  untaxed: number;
}

export interface PurchaseInvoiceSummary {
  count: number;
  netAmount: number;
  ivaAmount: number;
  totalAmount: number;
}

export interface PurchaseInvoiceListing {
  invoices: PurchaseInvoice[];
  summary: PurchaseInvoiceSummary;
}

const EMPTY_SUMMARY: PurchaseInvoiceSummary = { count: 0, netAmount: 0, ivaAmount: 0, totalAmount: 0 };

function isPresentNumber(value: number | undefined): value is number {
  return value !== undefined && value !== 0 && !Number.isNaN(value);
}

function mergeAmounts(input: UpdatePurchaseInvoiceInput, existing: PurchaseInvoice): Amounts {
  const amountOrExisting = (key: keyof Amounts): number => input[key] ?? Number(existing[key]);
  return {
    netAmount21: amountOrExisting("netAmount21"),
    iva21: amountOrExisting("iva21"),
    netAmount105: amountOrExisting("netAmount105"),
    iva105: amountOrExisting("iva105"),
    netAmount27: amountOrExisting("netAmount27"),
    iva27: amountOrExisting("iva27"),
    exempt: amountOrExisting("exempt"),
    untaxed: amountOrExisting("untaxed"),
  };
}

function addToSummary(summary: PurchaseInvoiceSummary, invoice: PurchaseInvoice): PurchaseInvoiceSummary {
  const netAmount = Number(invoice.netAmount21) + Number(invoice.netAmount105) + Number(invoice.netAmount27);
  const ivaAmount = Number(invoice.iva21) + Number(invoice.iva105) + Number(invoice.iva27);
  return {
    count: summary.count + 1,
    netAmount: summary.netAmount + netAmount,
    ivaAmount: summary.ivaAmount + ivaAmount,
    totalAmount: summary.totalAmount + Number(invoice.total),
  };
}

@Injectable()
export class PurchaseInvoicesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(issuerId: string, input: PurchaseInvoiceInput): Promise<PurchaseInvoice> {
    const total = purchaseInvoiceTotal(input);
    return await this.prisma.purchaseInvoice.create({
      data: {
        issuerId,
        supplierCuit: input.supplierCuit,
        supplierName: input.supplierName,
        invoiceType: input.invoiceType,
        salesPoint: input.salesPoint,
        number: input.number,
        issueDate: new Date(input.issueDate),
        ...optionalField("dueDate", parseOptionalDate(input.dueDate)),
        netAmount21: input.netAmount21,
        iva21: input.iva21,
        netAmount105: input.netAmount105,
        iva105: input.iva105,
        netAmount27: input.netAmount27,
        iva27: input.iva27,
        exempt: input.exempt,
        untaxed: input.untaxed,
        total,
      },
    });
  }

  async list(issuerId: string, year?: number, month?: number): Promise<PurchaseInvoiceListing> {
    const where: Prisma.PurchaseInvoiceWhereInput = { issuerId };
    if (isPresentNumber(year) && isPresentNumber(month)) {
      const from = new Date(Date.UTC(year, month - 1, 1));
      const to = new Date(Date.UTC(year, month, 1));
      where.issueDate = { gte: from, lt: to };
    }
    const invoices = await this.prisma.purchaseInvoice.findMany({
      where,
      orderBy: { issueDate: "desc" },
    });

    const summary = invoices.reduce(addToSummary, EMPTY_SUMMARY);

    return { invoices, summary };
  }

  async update(issuerId: string, id: string, input: UpdatePurchaseInvoiceInput): Promise<PurchaseInvoice> {
    const existing = await this.getScoped(issuerId, id);
    const merged = mergeAmounts(input, existing);

    return await this.prisma.purchaseInvoice.update({
      where: { id },
      data: {
        ...optionalField("supplierCuit", input.supplierCuit),
        ...optionalField("supplierName", input.supplierName),
        ...optionalField("invoiceType", input.invoiceType),
        ...optionalField("salesPoint", input.salesPoint),
        ...optionalField("number", input.number),
        ...optionalField("issueDate", parseOptionalDate(input.issueDate)),
        ...optionalField("dueDate", parseOptionalDate(input.dueDate)),
        ...merged,
        total: purchaseInvoiceTotal(merged),
      },
    });
  }

  async remove(issuerId: string, id: string): Promise<{ ok: boolean }> {
    await this.getScoped(issuerId, id);
    await this.prisma.purchaseInvoice.delete({ where: { id } });
    return { ok: true };
  }

  private async getScoped(issuerId: string, id: string): Promise<PurchaseInvoice> {
    const invoice = await this.prisma.purchaseInvoice.findFirst({
      where: { id, issuerId },
    });
    if (!invoice) {
      throw new NotFoundException("Factura de compra inexistente.");
    }
    return invoice;
  }
}
