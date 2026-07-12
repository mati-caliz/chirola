import { Injectable, NotFoundException } from '@nestjs/common';
import {
  purchaseInvoiceTotal,
  type PurchaseInvoiceInput,
  type UpdatePurchaseInvoiceInput,
} from '@chirola/shared';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

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

const AMOUNT_KEYS: (keyof Amounts)[] = [
  'netAmount21',
  'iva21',
  'netAmount105',
  'iva105',
  'netAmount27',
  'iva27',
  'exempt',
  'untaxed',
];

@Injectable()
export class PurchaseInvoicesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(issuerId: string, input: PurchaseInvoiceInput) {
    const total = purchaseInvoiceTotal(input);
    return this.prisma.purchaseInvoice.create({
      data: {
        issuerId,
        supplierCuit: input.supplierCuit,
        supplierName: input.supplierName,
        invoiceType: input.invoiceType,
        salesPoint: input.salesPoint,
        number: input.number,
        issueDate: new Date(input.issueDate),
        dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
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

  async list(issuerId: string, year?: number, month?: number) {
    const where: Prisma.PurchaseInvoiceWhereInput = { issuerId };
    if (year && month) {
      const from = new Date(Date.UTC(year, month - 1, 1));
      const to = new Date(Date.UTC(year, month, 1));
      where.issueDate = { gte: from, lt: to };
    }
    const invoices = await this.prisma.purchaseInvoice.findMany({
      where,
      orderBy: { issueDate: 'desc' },
    });

    const summary = invoices.reduce(
      (acc, invoice) => {
        const netAmount =
          Number(invoice.netAmount21) +
          Number(invoice.netAmount105) +
          Number(invoice.netAmount27);
        const ivaAmount =
          Number(invoice.iva21) + Number(invoice.iva105) + Number(invoice.iva27);
        return {
          count: acc.count + 1,
          netAmount: acc.netAmount + netAmount,
          ivaAmount: acc.ivaAmount + ivaAmount,
          totalAmount: acc.totalAmount + Number(invoice.total),
        };
      },
      { count: 0, netAmount: 0, ivaAmount: 0, totalAmount: 0 },
    );

    return { invoices, summary };
  }

  async update(
    issuerId: string,
    id: string,
    input: UpdatePurchaseInvoiceInput,
  ) {
    const existing = await this.getScoped(issuerId, id);
    const merged: Amounts = AMOUNT_KEYS.reduce((acc, key) => {
      acc[key] = input[key] ?? Number(existing[key]);
      return acc;
    }, {} as Amounts);

    return this.prisma.purchaseInvoice.update({
      where: { id },
      data: {
        supplierCuit: input.supplierCuit,
        supplierName: input.supplierName,
        invoiceType: input.invoiceType,
        salesPoint: input.salesPoint,
        number: input.number,
        issueDate: input.issueDate ? new Date(input.issueDate) : undefined,
        dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
        ...merged,
        total: purchaseInvoiceTotal(merged),
      },
    });
  }

  async remove(issuerId: string, id: string) {
    await this.getScoped(issuerId, id);
    await this.prisma.purchaseInvoice.delete({ where: { id } });
    return { ok: true };
  }

  private async getScoped(issuerId: string, id: string) {
    const invoice = await this.prisma.purchaseInvoice.findFirst({
      where: { id, issuerId },
    });
    if (!invoice) {
      throw new NotFoundException('Factura de compra inexistente.');
    }
    return invoice;
  }
}
