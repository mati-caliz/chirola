import { IvaPositionService } from "./iva-position.service";
import { PrismaService } from "../prisma/prisma.service";
import { instantiateWithDoubles } from "../common/testing/instantiate-with-doubles";

interface VoucherRow {
  voucherType: number;
  exchangeRate?: number;
  items: { ivaRate: number; subtotal: number }[];
}

interface PurchaseRow {
  invoiceType: number;
  iva21: number;
  iva105: number;
  iva27: number;
}

function fakePrisma(vouchers: VoucherRow[], purchases: PurchaseRow[]) {
  return {
    voucher: {
      findMany: () => Promise.resolve(vouchers),
    },
    purchaseInvoice: {
      findMany: () => Promise.resolve(purchases),
    },
  };
}

function serviceWith(prisma: ReturnType<typeof fakePrisma>): Promise<IvaPositionService> {
  return instantiateWithDoubles(IvaPositionService, [{ token: PrismaService, value: prisma }]);
}

describe("IvaPositionService", () => {
  it("calcula débito (ventas A/B) menos crédito (compras) por alícuota", async () => {
    const prisma = fakePrisma(
      [{ voucherType: 1, items: [{ ivaRate: 21, subtotal: 1210 }] }],
      [{ invoiceType: 1, iva21: 110, iva105: 0, iva27: 0 }],
    );
    const position = await (await serviceWith(prisma)).getMonthlyPosition("issuer-1", 2026, 7);

    expect(position.breakdown).toEqual([{ rate: 21, debit: 210, credit: 110, balance: 100 }]);
    expect(position.totalDebit).toBe(210);
    expect(position.totalCredit).toBe(110);
    expect(position.balance).toBe(100);
  });

  it("las notas de crédito restan del débito fiscal", async () => {
    const prisma = fakePrisma(
      [
        { voucherType: 1, items: [{ ivaRate: 21, subtotal: 1210 }] },
        { voucherType: 3, items: [{ ivaRate: 21, subtotal: 605 }] },
      ],
      [],
    );
    const position = await (await serviceWith(prisma)).getMonthlyPosition("issuer-1", 2026, 7);

    expect(position.totalDebit).toBe(105);
  });

  it("ignora comprobantes C (monotributo, sin IVA)", async () => {
    const prisma = fakePrisma([{ voucherType: 11, items: [{ ivaRate: 21, subtotal: 1210 }] }], []);
    const position = await (await serviceWith(prisma)).getMonthlyPosition("issuer-1", 2026, 7);

    expect(position.totalDebit).toBe(0);
    expect(position.breakdown).toEqual([]);
  });
});

describe("IvaPositionService — notas de crédito de compra", () => {
  it("resta del crédito fiscal la nota de crédito recibida", async () => {
    const prisma = fakePrisma(
      [],
      [
        { invoiceType: 1, iva21: 210, iva105: 0, iva27: 0 },
        { invoiceType: 3, iva21: 105, iva105: 0, iva27: 0 },
      ],
    );

    const position = await (await serviceWith(prisma)).getMonthlyPosition("issuer-1", 2026, 7);

    expect(position.totalCredit).toBe(105);
  });

  it("suma la nota de débito recibida, que no es lo mismo", async () => {
    const prisma = fakePrisma(
      [],
      [
        { invoiceType: 1, iva21: 210, iva105: 0, iva27: 0 },
        { invoiceType: 2, iva21: 105, iva105: 0, iva27: 0 },
      ],
    );

    const position = await (await serviceWith(prisma)).getMonthlyPosition("issuer-1", 2026, 7);

    expect(position.totalCredit).toBe(315);
  });
});

describe("IvaPositionService — moneda extranjera", () => {
  it("convierte a pesos el IVA de un comprobante en dólares con su cotización", async () => {
    const prisma = fakePrisma(
      [{ voucherType: 1, exchangeRate: 1000, items: [{ ivaRate: 21, subtotal: 121 }] }],
      [],
    );

    const position = await (await serviceWith(prisma)).getMonthlyPosition("issuer-1", 2026, 7);

    expect(position.totalDebit).toBe(21000);
  });
});
