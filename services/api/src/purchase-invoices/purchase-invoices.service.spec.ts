import { NotFoundException } from "@nestjs/common";
import type { PurchaseInvoiceInput } from "@chirola/shared";
import { PurchaseInvoicesService } from "./purchase-invoices.service";
import { PrismaService } from "../prisma/prisma.service";
import { instantiateWithDoubles } from "../common/testing/instantiate-with-doubles";

interface NewInvoice {
  issuerId: string;
  [field: string]: unknown;
}

interface StoredInvoice extends NewInvoice {
  id: string;
}

function fakePrisma() {
  const store = new Map<string, StoredInvoice>();
  let sequence = 0;
  return {
    purchaseInvoice: {
      create: ({ data }: { data: NewInvoice }) => {
        const row: StoredInvoice = { ...data, id: `pi-${String(++sequence)}` };
        store.set(row.id, row);
        return Promise.resolve(row);
      },
      findMany: ({ where }: { where: { issuerId: string } }) =>
        Promise.resolve([...store.values()].filter((row) => row.issuerId === where.issuerId)),
      findFirst: ({ where }: { where: { id: string; issuerId: string } }) =>
        Promise.resolve(
          [...store.values()].find((row) => row.id === where.id && row.issuerId === where.issuerId) ?? null,
        ),
      update: ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const existing = store.get(where.id);
        if (existing === undefined) return Promise.reject(new Error("Factura inexistente en el doble."));
        const row: StoredInvoice = { ...existing, ...data, id: existing.id, issuerId: existing.issuerId };
        store.set(where.id, row);
        return Promise.resolve(row);
      },
      delete: ({ where }: { where: { id: string } }) => {
        store.delete(where.id);
        return Promise.resolve({});
      },
    },
  };
}

function createService(): Promise<PurchaseInvoicesService> {
  return instantiateWithDoubles(PurchaseInvoicesService, [{ token: PrismaService, value: fakePrisma() }]);
}

function input(overrides: Partial<PurchaseInvoiceInput> = {}): PurchaseInvoiceInput {
  return {
    issuerId: "issuer-1",
    supplierCuit: "30707153745",
    supplierName: "Proveedor SA",
    invoiceType: 1,
    salesPoint: 1,
    number: 10,
    issueDate: "2026-07-01",
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

describe("PurchaseInvoicesService", () => {
  const ISSUER = "issuer-1";

  it("calcula el total a partir de netos + IVA + exento + no gravado", async () => {
    const service = await createService();
    const created = await service.create(ISSUER, input({ exempt: 50, untaxed: 40 }));
    expect(Number(created.total)).toBe(1300);
  });

  it("lista con resumen (neto, iva, total, cantidad) del emisor", async () => {
    const service = await createService();
    await service.create(ISSUER, input());
    await service.create(
      ISSUER,
      input({
        number: 11,
        netAmount21: 0,
        iva21: 0,
        netAmount105: 200,
        iva105: 21,
      }),
    );
    const { invoices, summary } = await service.list(ISSUER);
    expect(invoices).toHaveLength(2);
    expect(summary.count).toBe(2);
    expect(summary.netAmount).toBe(1200);
    expect(summary.ivaAmount).toBe(231);
    expect(summary.totalAmount).toBe(1431);
  });

  it("recalcula el total al actualizar campos parciales", async () => {
    const service = await createService();
    const created = await service.create(ISSUER, input());
    const updated = await service.update(ISSUER, created.id, {
      issuerId: ISSUER,
      iva21: 105,
      netAmount21: 500,
    });
    expect(Number(updated.total)).toBe(605);
  });

  it("no permite ver una factura de otro emisor (aislamiento)", async () => {
    const service = await createService();
    const created = await service.create(ISSUER, input());
    await expect(service.remove("otro-issuer", created.id)).rejects.toBeInstanceOf(NotFoundException);
  });
});
