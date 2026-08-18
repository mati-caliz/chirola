import {
  DocumentType,
  issueVoucherSchema,
  TaxTreatment,
  TransmissionType,
  VoucherConcept,
  VoucherType,
} from '@chirola/shared';

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

const validPeriod = { from: '2026-07-01', to: '2026-07-31' };

const validPaymentDueDate = '2026-08-10';

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
      input({
        concept: VoucherConcept.SERVICES,
        servicePeriod: validPeriod,
        paymentDueDate: validPaymentDueDate,
      }),
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

describe('issueVoucherSchema — identificación del receptor (C.1)', () => {
  it('rechaza una Factura A cuyo receptor no se identifica con CUIT', () => {
    const result = issueVoucherSchema.safeParse(
      input({
        voucherType: VoucherType.FACTURA_A,
        recipient: { docType: DocumentType.DNI, docNumber: '30111222' },
      }),
    );

    expect(result.success).toBe(false);
  });

  it('rechaza una Factura M cuyo receptor no se identifica con CUIT', () => {
    const result = issueVoucherSchema.safeParse(
      input({
        voucherType: VoucherType.FACTURA_M,
        recipient: { docType: DocumentType.CONSUMIDOR_FINAL, docNumber: '0' },
      }),
    );

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toContain('Factura M');
  });

  it('acepta una Factura M con CUIT', () => {
    const result = issueVoucherSchema.safeParse(
      input({
        voucherType: VoucherType.FACTURA_M,
        recipient: { docType: DocumentType.CUIT, docNumber: '30111222234' },
      }),
    );

    expect(result.success).toBe(true);
  });

  it('no exige CUIT en una Factura B', () => {
    const result = issueVoucherSchema.safeParse(
      input({ voucherType: VoucherType.FACTURA_B }),
    );

    expect(result.success).toBe(true);
  });
});

describe('issueVoucherSchema — Factura de Crédito MiPyME (C.2)', () => {
  const fceInput = (overrides: Record<string, unknown> = {}) =>
    input({
      voucherType: VoucherType.FCE_FACTURA_A,
      recipient: { docType: DocumentType.CUIT, docNumber: '30111222234' },
      ...overrides,
    });

  it('exige el vencimiento de pago aunque el concepto sea productos', () => {
    const result = issueVoucherSchema.safeParse(fceInput());

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['paymentDueDate']);
  });

  it('acepta la FCE de productos con vencimiento de pago y sin período', () => {
    const result = issueVoucherSchema.safeParse(
      fceInput({ paymentDueDate: '2026-09-30' }),
    );

    expect(result.success).toBe(true);
    expect(result.data?.servicePeriod).toBeUndefined();
  });

  it('rechaza el vencimiento de pago en una factura común de productos', () => {
    const result = issueVoucherSchema.safeParse(
      input({ paymentDueDate: '2026-09-30' }),
    );

    expect(result.success).toBe(false);
  });

  it('rechaza el tipo de transmisión en un comprobante que no es FCE', () => {
    const result = issueVoucherSchema.safeParse(
      input({ transmissionType: TransmissionType.COLLECTIVE_DEPOSIT }),
    );

    expect(result.success).toBe(false);
  });

  it('acepta el tipo de transmisión en la FCE', () => {
    const result = issueVoucherSchema.safeParse(
      fceInput({
        paymentDueDate: '2026-09-30',
        transmissionType: TransmissionType.COLLECTIVE_DEPOSIT,
      }),
    );

    expect(result.success).toBe(true);
  });

  it('exige CUIT del receptor en la FCE', () => {
    const result = issueVoucherSchema.safeParse(
      fceInput({
        paymentDueDate: '2026-09-30',
        recipient: { docType: DocumentType.DNI, docNumber: '30111222' },
      }),
    );

    expect(result.success).toBe(false);
  });
});
