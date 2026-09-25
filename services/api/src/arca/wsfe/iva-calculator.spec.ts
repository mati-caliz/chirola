import { TaxTreatment, VoucherType, type Item } from "@chirola/shared";
import { calculateAmounts } from "./iva-calculator";

const taxed = (overrides: Partial<Item> = {}): Item => ({
  description: "Item",
  quantity: 1,
  unitPrice: 1210,
  ivaRate: 21,
  taxTreatment: TaxTreatment.TAXED,
  ...overrides,
});

describe("calculateAmounts", () => {
  it("Factura C: no discrimina IVA (Neto = Total, IVA = 0)", () => {
    const voucherAmounts = calculateAmounts(VoucherType.FACTURA_C, [
      taxed({ description: "Cafe", quantity: 2, unitPrice: 1500 }),
    ]);
    expect(voucherAmounts.totalAmount).toBe(3000);
    expect(voucherAmounts.netAmount).toBe(3000);
    expect(voucherAmounts.ivaAmount).toBe(0);
    expect(voucherAmounts.rates).toHaveLength(0);
  });

  it("Factura A: discrimina IVA 21% desde el bruto y cuadra", () => {
    const voucherAmounts = calculateAmounts(VoucherType.FACTURA_A, [taxed({ description: "Servicio" })]);
    expect(voucherAmounts.totalAmount).toBe(1210);
    expect(voucherAmounts.netAmount).toBe(1000);
    expect(voucherAmounts.ivaAmount).toBe(210);
    expect(voucherAmounts.rates).toEqual([{ id: 5, taxableBase: 1000, amount: 210 }]);

    expect(voucherAmounts.netAmount + voucherAmounts.ivaAmount).toBeCloseTo(voucherAmounts.totalAmount, 2);
  });

  it("Factura B: informa a ARCA el neto, el IVA y las alícuotas aunque no los discrimine al receptor", () => {
    const result = calculateAmounts(VoucherType.FACTURA_B, [taxed({ description: "Servicio" })]);

    expect(result.totalAmount).toBe(1210);
    expect(result.netAmount).toBe(1000);
    expect(result.ivaAmount).toBe(210);
    expect(result.rates).toEqual([{ id: 5, taxableBase: 1000, amount: 210 }]);
  });

  it("Factura A con múltiples alícuotas: agrupa y cuadra", () => {
    const voucherAmounts = calculateAmounts(VoucherType.FACTURA_A, [
      taxed({ description: "Item 21" }),
      taxed({ description: "Item 10.5", unitPrice: 1105, ivaRate: 10.5 }),
    ]);
    expect(voucherAmounts.totalAmount).toBe(2315);
    expect(voucherAmounts.rates).toHaveLength(2);
    expect(voucherAmounts.netAmount + voucherAmounts.ivaAmount).toBeCloseTo(voucherAmounts.totalAmount, 2);
    const ids = voucherAmounts.rates.map((arcaIvaRate) => arcaIvaRate.id).sort((left, right) => left - right);
    expect(ids).toEqual([4, 5]);
  });
});

describe("calculateAmounts — exentos y no gravados", () => {
  const exempt = taxed({
    description: "Libro",
    unitPrice: 500,
    ivaRate: 0,
    taxTreatment: TaxTreatment.EXEMPT,
  });
  const untaxed = taxed({
    description: "Reintegro",
    unitPrice: 300,
    ivaRate: 0,
    taxTreatment: TaxTreatment.UNTAXED,
  });

  it("separa exento y no gravado de la base gravada", () => {
    const voucherAmounts = calculateAmounts(VoucherType.FACTURA_A, [taxed(), exempt, untaxed]);

    expect(voucherAmounts.netAmount).toBe(1000);
    expect(voucherAmounts.ivaAmount).toBe(210);
    expect(voucherAmounts.exemptAmount).toBe(500);
    expect(voucherAmounts.untaxedAmount).toBe(300);
    expect(voucherAmounts.totalAmount).toBe(2010);
  });

  it("mantiene la identidad de totales que valida ARCA", () => {
    const voucherAmounts = calculateAmounts(VoucherType.FACTURA_A, [taxed(), exempt, untaxed]);

    expect(
      voucherAmounts.untaxedAmount +
        voucherAmounts.netAmount +
        voucherAmounts.exemptAmount +
        voucherAmounts.ivaAmount +
        voucherAmounts.tributeAmount,
    ).toBeCloseTo(voucherAmounts.totalAmount, 2);
  });

  it("no genera alícuota de IVA para los ítems exentos", () => {
    const voucherAmounts = calculateAmounts(VoucherType.FACTURA_A, [exempt]);

    expect(voucherAmounts.rates).toHaveLength(0);
  });

  it("distingue un ítem gravado al 0% de uno exento", () => {
    const zeroRated = calculateAmounts(VoucherType.FACTURA_A, [taxed({ unitPrice: 500, ivaRate: 0 })]);

    expect(zeroRated.rates).toEqual([{ id: 3, taxableBase: 500, amount: 0 }]);
    expect(zeroRated.netAmount).toBe(500);
    expect(zeroRated.exemptAmount).toBe(0);

    const exempted = calculateAmounts(VoucherType.FACTURA_A, [exempt]);

    expect(exempted.rates).toHaveLength(0);
    expect(exempted.netAmount).toBe(0);
    expect(exempted.exemptAmount).toBe(500);
  });
});

describe("calculateAmounts — tributos", () => {
  const perception = {
    id: 2,
    description: "Percepción IIBB CABA",
    taxableBase: 1000,
    rate: 3,
  };

  it("calcula el importe del tributo desde base y alícuota", () => {
    const voucherAmounts = calculateAmounts(VoucherType.FACTURA_A, [taxed()], [perception]);

    expect(voucherAmounts.tributes).toEqual([
      {
        id: 2,
        description: "Percepción IIBB CABA",
        taxableBase: 1000,
        rate: 3,
        amount: 30,
      },
    ]);
    expect(voucherAmounts.tributeAmount).toBe(30);
  });

  it("suma los tributos al total del comprobante", () => {
    const voucherAmounts = calculateAmounts(VoucherType.FACTURA_A, [taxed()], [perception]);

    expect(voucherAmounts.totalAmount).toBe(1240);
    expect(
      voucherAmounts.untaxedAmount +
        voucherAmounts.netAmount +
        voucherAmounts.exemptAmount +
        voucherAmounts.ivaAmount +
        voucherAmounts.tributeAmount,
    ).toBeCloseTo(voucherAmounts.totalAmount, 2);
  });

  it("acumula varios tributos", () => {
    const voucherAmounts = calculateAmounts(
      VoucherType.FACTURA_A,
      [taxed()],
      [perception, { id: 3, description: "Tasa municipal", taxableBase: 1000, rate: 1 }],
    );

    expect(voucherAmounts.tributeAmount).toBe(40);
    expect(voucherAmounts.tributes).toHaveLength(2);
  });

  it("aplica tributos también en Factura C", () => {
    const voucherAmounts = calculateAmounts(
      VoucherType.FACTURA_C,
      [taxed({ unitPrice: 1000 })],
      [perception],
    );

    expect(voucherAmounts.netAmount).toBe(1000);
    expect(voucherAmounts.tributeAmount).toBe(30);
    expect(voucherAmounts.totalAmount).toBe(1030);
  });
});

describe("calculateAmounts — Factura M (C.1)", () => {
  it("discrimina IVA igual que la Factura A", () => {
    const facturaMAmounts = calculateAmounts(VoucherType.FACTURA_M, [taxed()]);
    const facturaAAmounts = calculateAmounts(VoucherType.FACTURA_A, [taxed()]);

    expect(facturaMAmounts).toEqual(facturaAAmounts);
  });

  it("separa exentos y no gravados en la Factura M", () => {
    const voucherAmounts = calculateAmounts(VoucherType.FACTURA_M, [
      taxed({ unitPrice: 1210 }),
      taxed({ unitPrice: 500, ivaRate: 0, taxTreatment: TaxTreatment.EXEMPT }),
      taxed({ unitPrice: 300, ivaRate: 0, taxTreatment: TaxTreatment.UNTAXED }),
    ]);

    expect(voucherAmounts.netAmount).toBe(1000);
    expect(voucherAmounts.ivaAmount).toBe(210);
    expect(voucherAmounts.exemptAmount).toBe(500);
    expect(voucherAmounts.untaxedAmount).toBe(300);
    expect(voucherAmounts.totalAmount).toBe(2010);
  });
});
