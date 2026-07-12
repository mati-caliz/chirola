import { IvaPositionService } from './iva-position.service';
import type { PrismaService } from '../prisma/prisma.service';

interface VoucherRow {
  voucherType: number;
  items: { ivaRate: number; subtotal: number }[];
}

function fakePrisma(
  vouchers: VoucherRow[],
  purchases: { iva21: number; iva105: number; iva27: number }[],
): PrismaService {
  return {
    voucher: {
      findMany: async () => vouchers,
    },
    purchaseInvoice: {
      findMany: async () => purchases,
    },
  } as unknown as PrismaService;
}

describe('IvaPositionService', () => {
  it('calcula débito (ventas A/B) menos crédito (compras) por alícuota', async () => {
    const prisma = fakePrisma(
      [{ voucherType: 1, items: [{ ivaRate: 21, subtotal: 1210 }] }],
      [{ iva21: 110, iva105: 0, iva27: 0 }],
    );
    const position = await new IvaPositionService(prisma).getMonthlyPosition(
      'issuer-1',
      2026,
      7,
    );

    expect(position.breakdown).toEqual([
      { rate: 21, debit: 210, credit: 110, balance: 100 },
    ]);
    expect(position.totalDebit).toBe(210);
    expect(position.totalCredit).toBe(110);
    expect(position.balance).toBe(100);
  });

  it('las notas de crédito restan del débito fiscal', async () => {
    const prisma = fakePrisma(
      [
        { voucherType: 1, items: [{ ivaRate: 21, subtotal: 1210 }] },
        { voucherType: 3, items: [{ ivaRate: 21, subtotal: 605 }] },
      ],
      [],
    );
    const position = await new IvaPositionService(prisma).getMonthlyPosition(
      'issuer-1',
      2026,
      7,
    );

    expect(position.totalDebit).toBe(105);
  });

  it('ignora comprobantes C (monotributo, sin IVA)', async () => {
    const prisma = fakePrisma(
      [{ voucherType: 11, items: [{ ivaRate: 21, subtotal: 1210 }] }],
      [],
    );
    const position = await new IvaPositionService(prisma).getMonthlyPosition(
      'issuer-1',
      2026,
      7,
    );

    expect(position.totalDebit).toBe(0);
    expect(position.breakdown).toEqual([]);
  });
});
