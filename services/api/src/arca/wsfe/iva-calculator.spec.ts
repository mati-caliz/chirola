import { VoucherType } from '@chirola/shared';
import { calculateAmounts } from './iva-calculator';

describe('calculateAmounts', () => {
  it('Factura C: no discrimina IVA (Neto = Total, IVA = 0)', () => {
    const r = calculateAmounts(VoucherType.FACTURA_C, [
      { description: 'Cafe', quantity: 2, unitPrice: 1500, ivaRate: 21 },
    ]);
    expect(r.totalAmount).toBe(3000);
    expect(r.netAmount).toBe(3000);
    expect(r.ivaAmount).toBe(0);
    expect(r.rates).toHaveLength(0);
  });

  it('Factura A: discrimina IVA 21% desde el bruto y cuadra', () => {
    const r = calculateAmounts(VoucherType.FACTURA_A, [
      { description: 'Servicio', quantity: 1, unitPrice: 1210, ivaRate: 21 },
    ]);
    expect(r.totalAmount).toBe(1210);
    expect(r.netAmount).toBe(1000);
    expect(r.ivaAmount).toBe(210);
    expect(r.rates).toEqual([{ id: 5, taxableBase: 1000, amount: 210 }]);

    expect(r.netAmount + r.ivaAmount).toBeCloseTo(r.totalAmount, 2);
  });

  it('Factura A con múltiples alícuotas: agrupa y cuadra', () => {
    const r = calculateAmounts(VoucherType.FACTURA_A, [
      { description: 'Item 21', quantity: 1, unitPrice: 1210, ivaRate: 21 },
      { description: 'Item 10.5', quantity: 1, unitPrice: 1105, ivaRate: 10.5 },
    ]);
    expect(r.totalAmount).toBe(2315);
    expect(r.rates).toHaveLength(2);
    expect(r.netAmount + r.ivaAmount).toBeCloseTo(r.totalAmount, 2);
    const ids = r.rates.map((a) => a.id).sort();
    expect(ids).toEqual([4, 5]);
  });
});
