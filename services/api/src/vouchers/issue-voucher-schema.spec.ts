import { issueVoucherSchema, TaxTreatment, VoucherConcept } from '@chirola/shared';

function input(overrides: Record<string, unknown> = {}) {
  return {
    issuerId: 'issuer-1',
    salesPoint: 1,
    voucherType: 11,
    concept: VoucherConcept.PRODUCTS,
    recipient: { docType: 99, docNumber: '0' },
    items: [{ description: 'Item', quantity: 1, unitPrice: 100, ivaRate: 21 }],
    ...overrides,
  };
}

const validPeriod = {
  from: '2026-07-01',
  to: '2026-07-31',
  paymentDueDate: '2026-08-10',
};

describe('issueVoucherSchema — tratamiento fiscal de los ítems', () => {
  it('asume gravado cuando no se especifica', () => {
    const result = issueVoucherSchema.parse(input());

    expect(result.items[0].taxTreatment).toBe(TaxTreatment.TAXED);
  });

  it('acepta un ítem exento sin alícuota', () => {
    const result = issueVoucherSchema.safeParse(
      input({
        items: [
          {
            description: 'Libro',
            quantity: 1,
            unitPrice: 500,
            ivaRate: 0,
            taxTreatment: TaxTreatment.EXEMPT,
          },
        ],
      }),
    );

    expect(result.success).toBe(true);
  });

  it('rechaza un ítem exento con alícuota de IVA', () => {
    const result = issueVoucherSchema.safeParse(
      input({
        items: [
          {
            description: 'Libro',
            quantity: 1,
            unitPrice: 500,
            ivaRate: 21,
            taxTreatment: TaxTreatment.EXEMPT,
          },
        ],
      }),
    );

    expect(result.success).toBe(false);
  });
});

describe('issueVoucherSchema — tributos', () => {
  const tribute = {
    id: 2,
    description: 'Percepción IIBB CABA',
    taxableBase: 1000,
    rate: 3,
  };

  it('acepta un comprobante sin tributos', () => {
    expect(issueVoucherSchema.safeParse(input()).success).toBe(true);
  });

  it('acepta tributos con base y alícuota', () => {
    expect(
      issueVoucherSchema.safeParse(input({ tributes: [tribute] })).success,
    ).toBe(true);
  });

  it('rechaza un tributo sin descripción', () => {
    const result = issueVoucherSchema.safeParse(
      input({ tributes: [{ ...tribute, description: '' }] }),
    );

    expect(result.success).toBe(false);
  });

  it('rechaza una base imponible negativa', () => {
    const result = issueVoucherSchema.safeParse(
      input({ tributes: [{ ...tribute, taxableBase: -1 }] }),
    );

    expect(result.success).toBe(false);
  });
});

describe('issueVoucherSchema — período de servicios', () => {
  it('acepta concepto productos sin período', () => {
    expect(issueVoucherSchema.safeParse(input()).success).toBe(true);
  });

  it('rechaza concepto servicios sin período', () => {
    const result = issueVoucherSchema.safeParse(
      input({ concept: VoucherConcept.SERVICES }),
    );

    expect(result.success).toBe(false);
  });

  it('acepta concepto servicios con período completo', () => {
    const result = issueVoucherSchema.safeParse(
      input({ concept: VoucherConcept.SERVICES, servicePeriod: validPeriod }),
    );

    expect(result.success).toBe(true);
  });

  it('rechaza concepto productos y servicios sin período', () => {
    const result = issueVoucherSchema.safeParse(
      input({ concept: VoucherConcept.PRODUCTS_AND_SERVICES }),
    );

    expect(result.success).toBe(false);
  });

  it('rechaza un período con fin anterior al inicio', () => {
    const result = issueVoucherSchema.safeParse(
      input({
        concept: VoucherConcept.SERVICES,
        servicePeriod: { ...validPeriod, from: '2026-07-31', to: '2026-07-01' },
      }),
    );

    expect(result.success).toBe(false);
  });

  it('rechaza un período en un comprobante de productos', () => {
    const result = issueVoucherSchema.safeParse(
      input({ concept: VoucherConcept.PRODUCTS, servicePeriod: validPeriod }),
    );

    expect(result.success).toBe(false);
  });

  it('rechaza fechas que no sean AAAA-MM-DD', () => {
    const result = issueVoucherSchema.safeParse(
      input({
        concept: VoucherConcept.SERVICES,
        servicePeriod: { ...validPeriod, from: '20260701' },
      }),
    );

    expect(result.success).toBe(false);
  });
});
