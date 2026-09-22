import { VoucherType } from '@chirola/shared';
import { buildSalesBook, type SalesBookVoucherRow } from './sales-book.service';
import { renderSalesBookCsv } from './sales-book-csv';

interface ItemRow {
  ivaRate: number;
  subtotal: number;
  taxTreatment: string;
}

interface VoucherRowOverrides {
  voucherType?: number;
  number?: number;
  exchangeRate?: number;
  currency?: string;
  totalAmount?: number;
  items?: ItemRow[];
}

function voucherRow(overrides: VoucherRowOverrides = {}): SalesBookVoucherRow {
  return {
    id: `voucher-${overrides.number ?? 1}`,
    voucherDate: new Date('2026-07-15T00:00:00Z'),
    voucherType: overrides.voucherType ?? VoucherType.FACTURA_A,
    number: overrides.number ?? 1,
    salesPoint: { number: 2 },
    recipientDocType: 80,
    recipientDocNumber: '20111111112',
    recipientName: 'Cliente; S.A.',
    client: null,
    qrData: null,
    currency: overrides.currency ?? 'PES',
    exchangeRate: overrides.exchangeRate ?? 1,
    tributeAmount: 0,
    totalAmount: overrides.totalAmount ?? 1210,
    cae: '12345678901234',
    items: overrides.items ?? [{ ivaRate: 21, subtotal: 1210, taxTreatment: 'TAXED' }],
  };
}

const bookOf = (vouchers: SalesBookVoucherRow[]) => buildSalesBook(2026, 7, vouchers);

describe('buildSalesBook', () => {
  it('desglosa neto, exento e IVA por alícuota de cada comprobante', () => {
    const book = bookOf([
      voucherRow({
        totalAmount: 1310,
        items: [
          { ivaRate: 21, subtotal: 1210, taxTreatment: 'TAXED' },
          { ivaRate: 0, subtotal: 100, taxTreatment: 'EXEMPT' },
        ],
      }),
    ]);

    expect(book.entries[0]).toMatchObject({
      netAmount: 1000,
      exemptAmount: 100,
      ivaByRate: [{ rate: 21, amount: 210 }],
      ivaAmount: 210,
      totalAmount: 1310,
    });
  });

  it('las notas de crédito restan en el libro y en los totales', () => {
    const book = bookOf([
      voucherRow({ number: 1 }),
      voucherRow({
        number: 2,
        voucherType: VoucherType.NOTA_CREDITO_A,
        totalAmount: 605,
        items: [{ ivaRate: 21, subtotal: 605, taxTreatment: 'TAXED' }],
      }),
    ]);

    expect(book.entries[1].ivaAmount).toBe(-105);
    expect(book.totals).toMatchObject({ voucherCount: 2, ivaAmount: 105, totalAmount: 605 });
  });

  it('expresa en pesos los comprobantes en moneda extranjera', () => {
    const book = bookOf([
      voucherRow({
        currency: 'DOL',
        exchangeRate: 1000,
        totalAmount: 121,
        items: [{ ivaRate: 21, subtotal: 121, taxTreatment: 'TAXED' }],
      }),
    ]);

    expect(book.entries[0]).toMatchObject({ netAmount: 100000, ivaAmount: 21000, totalAmount: 121000 });
  });
});

describe('renderSalesBookCsv', () => {
  it('usa punto y coma, coma decimal y cita los textos con separadores', () => {
    const book = bookOf([voucherRow()]);
    const lines = renderSalesBookCsv(book).split('\r\n');

    expect(lines[1]).toContain('15/07/2026;Factura A;0002;00000001;CUIT;20111111112;"Cliente; S.A."');
    expect(lines[1]).toContain('1000,00');
    expect(lines[2].startsWith('Totales;1 comprobantes')).toBe(true);
  });
});
