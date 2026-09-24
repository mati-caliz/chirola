import { TaxTreatment, TributeType, VoucherType } from '@chirola/shared';
import { buildFiscalTransparency, type FiscalTransparencySource } from './fiscal-transparency';

const taxedItem = {
  quantity: 1,
  unitPrice: 121,
  ivaRate: 21,
  taxTreatment: TaxTreatment.TAXED,
};

function source(overrides: Partial<FiscalTransparencySource> = {}): FiscalTransparencySource {
  return {
    voucherType: VoucherType.FACTURA_B,
    ivaAmount: 0,
    items: [taxedItem],
    tributes: [],
    ...overrides,
  };
}

describe('buildFiscalTransparency', () => {
  it.each([VoucherType.FACTURA_B, VoucherType.NOTA_DEBITO_B, VoucherType.NOTA_CREDITO_B])(
    'informa la leyenda en el comprobante clase B %i',
    (voucherType) => {
      expect(buildFiscalTransparency(source({ voucherType }))).not.toBeNull();
    },
  );

  it.each([VoucherType.FACTURA_A, VoucherType.FACTURA_C, VoucherType.FACTURA_M, VoucherType.FCE_FACTURA_B])(
    'no informa la leyenda en el comprobante %i',
    (voucherType) => {
      expect(buildFiscalTransparency(source({ voucherType }))).toBeNull();
    },
  );

  it('usa el IVA guardado del comprobante cuando lo tiene', () => {
    expect(buildFiscalTransparency(source({ ivaAmount: 42.5 }))).toEqual({
      containedIva: 42.5,
      otherNationalIndirectTaxes: 0,
    });
  });

  it('calcula el IVA contenido en el precio de los ítems gravados cuando no está discriminado', () => {
    const transparency = buildFiscalTransparency(
      source({
        items: [
          taxedItem,
          { quantity: 2, unitPrice: 52.5, ivaRate: 10.5, taxTreatment: TaxTreatment.TAXED },
          { quantity: 1, unitPrice: 500, ivaRate: 0, taxTreatment: TaxTreatment.EXEMPT },
        ],
      }),
    );
    expect(transparency?.containedIva).toBe(30.98);
  });

  it('suma como otros impuestos nacionales indirectos sólo los tributos nacionales e internos', () => {
    const transparency = buildFiscalTransparency(
      source({
        tributes: [
          { id: TributeType.NATIONAL, amount: 10.1 },
          { id: TributeType.INTERNAL, amount: 5.2 },
          { id: TributeType.PROVINCIAL, amount: 30 },
          { amount: 7 },
        ],
      }),
    );
    expect(transparency?.otherNationalIndirectTaxes).toBe(15.3);
  });
});
