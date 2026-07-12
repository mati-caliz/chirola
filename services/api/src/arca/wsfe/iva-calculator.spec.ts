import { TipoComprobante } from '@chirola/shared';
import { calcularImportes } from './iva-calculator';

describe('calcularImportes', () => {
  it('Factura C: no discrimina IVA (Neto = Total, IVA = 0)', () => {
    const r = calcularImportes(TipoComprobante.FACTURA_C, [
      { descripcion: 'Cafe', cantidad: 2, precioUnit: 1500, alicuotaIva: 21 },
    ]);
    expect(r.impTotal).toBe(3000);
    expect(r.impNeto).toBe(3000);
    expect(r.impIva).toBe(0);
    expect(r.alicuotas).toHaveLength(0);
  });

  it('Factura A: discrimina IVA 21% desde el bruto y cuadra', () => {
    const r = calcularImportes(TipoComprobante.FACTURA_A, [
      { descripcion: 'Servicio', cantidad: 1, precioUnit: 1210, alicuotaIva: 21 },
    ]);
    expect(r.impTotal).toBe(1210);
    expect(r.impNeto).toBe(1000);
    expect(r.impIva).toBe(210);
    expect(r.alicuotas).toEqual([{ id: 5, baseImp: 1000, importe: 210 }]);

    expect(r.impNeto + r.impIva).toBeCloseTo(r.impTotal, 2);
  });

  it('Factura A con múltiples alícuotas: agrupa y cuadra', () => {
    const r = calcularImportes(TipoComprobante.FACTURA_A, [
      { descripcion: 'Item 21', cantidad: 1, precioUnit: 1210, alicuotaIva: 21 },
      { descripcion: 'Item 10.5', cantidad: 1, precioUnit: 1105, alicuotaIva: 10.5 },
    ]);
    expect(r.impTotal).toBe(2315);
    expect(r.alicuotas).toHaveLength(2);
    expect(r.impNeto + r.impIva).toBeCloseTo(r.impTotal, 2);
    const ids = r.alicuotas.map((a) => a.id).sort();
    expect(ids).toEqual([4, 5]);
  });
});
