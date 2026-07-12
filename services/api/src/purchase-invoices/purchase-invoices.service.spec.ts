import { NotFoundException } from '@nestjs/common';
import type { PurchaseInvoiceInput } from '@chirola/shared';
import { PurchaseInvoicesService } from './purchase-invoices.service';
import type { PrismaService } from '../prisma/prisma.service';

type Row = Record<string, unknown>;

function fakePrisma(): PrismaService {
  const store = new Map<string, Row>();
  let seq = 0;
  return {
    purchaseInvoice: {
      create: async ({ data }: { data: Row }) => {
        const row: Row = { id: `pi-${++seq}`, ...data };
        store.set(row.id as string, row);
        return row;
      },
      findMany: async ({ where }: { where: { issuerId: string } }) =>
        [...store.values()].filter((r) => r.issuerId === where.issuerId),
      findFirst: async ({ where }: { where: { id: string; issuerId: string } }) =>
        [...store.values()].find(
          (r) => r.id === where.id && r.issuerId === where.issuerId,
        ) ?? null,
      update: async ({ where, data }: { where: { id: string }; data: Row }) => {
        const row = { ...store.get(where.id), ...data };
        store.set(where.id, row);
        return row;
      },
      delete: async ({ where }: { where: { id: string } }) => {
        store.delete(where.id);
        return {};
      },
    },
  } as unknown as PrismaService;
}

function input(overrides: Partial<PurchaseInvoiceInput> = {}): PurchaseInvoiceInput {
  return {
    issuerId: 'issuer-1',
    supplierCuit: '30707153745',
    supplierName: 'Proveedor SA',
    invoiceType: 1,
    salesPoint: 1,
    number: 10,
    issueDate: '2026-07-01',
    netAmount21: 1000,
    iva21: 210,
    netAmount105: 0,
    iva105: 0,
    netAmount27: 0,
    iva27: 0,
    exempt: 0,
    untaxed: 0,
    ...overrides,
  };
}

describe('PurchaseInvoicesService', () => {
  const ISSUER = 'issuer-1';

  it('calcula el total a partir de netos + IVA + exento + no gravado', async () => {
    const svc = new PurchaseInvoicesService(fakePrisma());
    const created = await svc.create(ISSUER, input({ exempt: 50, untaxed: 40 }));
    expect(Number(created.total)).toBe(1300);
  });

  it('lista con resumen (neto, iva, total, cantidad) del emisor', async () => {
    const svc = new PurchaseInvoicesService(fakePrisma());
    await svc.create(ISSUER, input());
    await svc.create(
      ISSUER,
      input({
        number: 11,
        netAmount21: 0,
        iva21: 0,
        netAmount105: 200,
        iva105: 21,
      }),
    );
    const { invoices, summary } = await svc.list(ISSUER);
    expect(invoices).toHaveLength(2);
    expect(summary.count).toBe(2);
    expect(summary.netAmount).toBe(1200);
    expect(summary.ivaAmount).toBe(231);
    expect(summary.totalAmount).toBe(1431);
  });

  it('recalcula el total al actualizar campos parciales', async () => {
    const svc = new PurchaseInvoicesService(fakePrisma());
    const created = await svc.create(ISSUER, input());
    const updated = await svc.update(ISSUER, created.id, {
      issuerId: ISSUER,
      iva21: 105,
      netAmount21: 500,
    });
    expect(Number(updated.total)).toBe(605);
  });

  it('no permite ver una factura de otro emisor (aislamiento)', async () => {
    const svc = new PurchaseInvoicesService(fakePrisma());
    const created = await svc.create(ISSUER, input());
    await expect(
      svc.remove('otro-issuer', created.id),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
