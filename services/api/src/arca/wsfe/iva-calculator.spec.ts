import { TaxTreatment, VoucherType, type Item } from '@chirola/shared';
import { calculateAmounts } from './iva-calculator';

const taxed = (overrides: Partial<Item> = {}): Item => ({
  description: 'Item',
  quantity: 1,
  unitPrice: 1210,
  ivaRate: 21,
  taxTreatment: TaxTreatment.TAXED,
  ...overrides,
});

describe('calculateAmounts', () => {
  it('Factura C: no discrimina IVA (Neto = Total, IVA = 0)', () => {
    const r = calculateAmounts(VoucherType.FACTURA_C, [
      taxed({ description: 'Cafe', quantity: 2, unitPrice: 1500 }),
    ]);
    expect(r.totalAmount).toBe(3000);
    expect(r.netAmount).toBe(3000);
    expect(r.ivaAmount).toBe(0);
    expect(r.rates).toHaveLength(0);
  });

  it('Factura A: discrimina IVA 21% desde el bruto y cuadra', () => {
    const r = calculateAmounts(VoucherType.FACTURA_A, [
      taxed({ description: 'Servicio' }),
    ]);
    expect(r.totalAmount).toBe(1210);
    expect(r.netAmount).toBe(1000);
    expect(r.ivaAmount).toBe(210);
    expect(r.rates).toEqual([{ id: 5, taxableBase: 1000, amount: 210 }]);

    expect(r.netAmount + r.ivaAmount).toBeCloseTo(r.totalAmount, 2);
  });

  it('Factura A con múltiples alícuotas: agrupa y cuadra', () => {
    const r = calculateAmounts(VoucherType.FACTURA_A, [
      taxed({ description: 'Item 21' }),
      taxed({ description: 'Item 10.5', unitPrice: 1105, ivaRate: 10.5 }),
    ]);
    expect(r.totalAmount).toBe(2315);
    expect(r.rates).toHaveLength(2);
    expect(r.netAmount + r.ivaAmount).toBeCloseTo(r.totalAmount, 2);
    const ids = r.rates.map((a) => a.id).sort();
    expect(ids).toEqual([4, 5]);
  });
});

describe('calculateAmounts — exentos y no gravados', () => {
  const exempt = taxed({
    description: 'Libro',
    unitPrice: 500,
    ivaRate: 0,
    taxTreatment: TaxTreatment.EXEMPT,
  });
  const untaxed = taxed({
    description: 'Reintegro',
    unitPrice: 300,
    ivaRate: 0,
    taxTreatment: TaxTreatment.UNTAXED,
  });

  it('separa exento y no gravado de la base gravada', () => {
    const r = calculateAmounts(VoucherType.FACTURA_A, [taxed(), exempt, untaxed]);

    expect(r.netAmount).toBe(1000);
    expect(r.ivaAmount).toBe(210);
    expect(r.exemptAmount).toBe(500);
    expect(r.untaxedAmount).toBe(300);
    expect(r.totalAmount).toBe(2010);
  });

  it('mantiene la identidad de totales que valida ARCA', () => {
    const r = calculateAmounts(VoucherType.FACTURA_A, [taxed(), exempt, untaxed]);

    expect(
      r.untaxedAmount + r.netAmount + r.exemptAmount + r.ivaAmount + r.tributeAmount,
    ).toBeCloseTo(r.totalAmount, 2);
  });

  it('no genera alícuota de IVA para los ítems exentos', () => {
    const r = calculateAmounts(VoucherType.FACTURA_A, [exempt]);

    expect(r.rates).toHaveLength(0);
  });

  it('distingue un ítem gravado al 0% de uno exento', () => {
    const zeroRated = calculateAmounts(VoucherType.FACTURA_A, [
      taxed({ unitPrice: 500, ivaRate: 0 }),
    ]);

    expect(zeroRated.rates).toEqual([{ id: 3, taxableBase: 500, amount: 0 }]);
    expect(zeroRated.netAmount).toBe(500);
    expect(zeroRated.exemptAmount).toBe(0);

    const exempted = calculateAmounts(VoucherType.FACTURA_A, [exempt]);

    expect(exempted.rates).toHaveLength(0);
    expect(exempted.netAmount).toBe(0);
    expect(exempted.exemptAmount).toBe(500);
  });
});

describe('calculateAmounts — tributos', () => {
  const perception = {
    id: 2,
    description: 'Percepción IIBB CABA',
    taxableBase: 1000,
    rate: 3,
  };

  it('calcula el importe del tributo desde base y alícuota', () => {
    const r = calculateAmounts(VoucherType.FACTURA_A, [taxed()], [perception]);

    expect(r.tributes).toEqual([
      {
        id: 2,
        description: 'Percepción IIBB CABA',
        taxableBase: 1000,
        rate: 3,
        amount: 30,
      },
    ]);
    expect(r.tributeAmount).toBe(30);
  });

  it('suma los tributos al total del comprobante', () => {
    const r = calculateAmounts(VoucherType.FACTURA_A, [taxed()], [perception]);

    expect(r.totalAmount).toBe(1240);
    expect(
      r.untaxedAmount + r.netAmount + r.exemptAmount + r.ivaAmount + r.tributeAmount,
    ).toBeCloseTo(r.totalAmount, 2);
  });

  it('acumula varios tributos', () => {
    const r = calculateAmounts(
      VoucherType.FACTURA_A,
      [taxed()],
      [perception, { id: 3, description: 'Tasa municipal', taxableBase: 1000, rate: 1 }],
    );

    expect(r.tributeAmount).toBe(40);
    expect(r.tributes).toHaveLength(2);
  });

  it('aplica tributos también en Factura C', () => {
    const r = calculateAmounts(
      VoucherType.FACTURA_C,
      [taxed({ unitPrice: 1000 })],
      [perception],
    );

    expect(r.netAmount).toBe(1000);
    expect(r.tributeAmount).toBe(30);
    expect(r.totalAmount).toBe(1030);
  });
});

describe('calculateAmounts — Factura M (C.1)', () => {
  it('discrimina IVA igual que la Factura A', () => {
    const m = calculateAmounts(VoucherType.FACTURA_M, [taxed()]);
    const a = calculateAmounts(VoucherType.FACTURA_A, [taxed()]);

    expect(m).toEqual(a);
  });

  it('separa exentos y no gravados en la Factura M', () => {
    const r = calculateAmounts(VoucherType.FACTURA_M, [
      taxed({ unitPrice: 1210 }),
      taxed({ unitPrice: 500, ivaRate: 0, taxTreatment: TaxTreatment.EXEMPT }),
      taxed({ unitPrice: 300, ivaRate: 0, taxTreatment: TaxTreatment.UNTAXED }),
    ]);

    expect(r.netAmount).toBe(1000);
    expect(r.ivaAmount).toBe(210);
    expect(r.exemptAmount).toBe(500);
    expect(r.untaxedAmount).toBe(300);
    expect(r.totalAmount).toBe(2010);
  });
});
