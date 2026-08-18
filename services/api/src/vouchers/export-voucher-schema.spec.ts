import {
  ExportType,
  exportVoucherTotal,
  issueExportVoucherSchema,
  isExportVoucher,
  VoucherLanguage,
  VoucherType,
  voucherLetter,
} from '@chirola/shared';

function input(overrides: Record<string, unknown> = {}) {
  return {
    issuerId: 'issuer-1',
    salesPoint: 1,
    voucherType: VoucherType.FACTURA_E,
    exportType: ExportType.SERVICES,
    destinationCountryId: 212,
    countryTaxId: '50000000016',
    client: { legalName: 'Acme Inc', address: '1 Infinite Loop' },
    currency: 'DOL',
    exchangeRate: 1305.5,
    language: VoucherLanguage.ENGLISH,
    items: [
      {
        description: 'Desarrollo de software',
        quantity: 1,
        unitOfMeasureId: 7,
        unitPrice: 5000,
      },
    ],
    ...overrides,
  };
}

describe('comprobantes de exportación (C.3)', () => {
  it('la letra E no discrimina IVA ni exige CUIT argentino', () => {
    expect(voucherLetter(VoucherType.FACTURA_E)).toBe('E');
    expect(isExportVoucher(VoucherType.FACTURA_E)).toBe(true);
  });

  it('acepta una exportación de servicios sin Incoterm ni permiso', () => {
    expect(issueExportVoucherSchema.safeParse(input()).success).toBe(true);
  });

  it('exige el Incoterm en la exportación de bienes', () => {
    const result = issueExportVoucherSchema.safeParse(
      input({ exportType: ExportType.GOODS }),
    );

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toContain('Incoterm');
  });

  it('rechaza el permiso de embarque en una exportación de servicios', () => {
    const result = issueExportVoucherSchema.safeParse(
      input({
        shippingPermits: [{ permitId: '16033EC01', destinationCountryId: 212 }],
      }),
    );

    expect(result.success).toBe(false);
  });

  it('acepta bienes con Incoterm y permiso', () => {
    const result = issueExportVoucherSchema.safeParse(
      input({
        exportType: ExportType.GOODS,
        incoterm: 'FOB',
        shippingPermits: [{ permitId: '16033EC01', destinationCountryId: 212 }],
      }),
    );

    expect(result.success).toBe(true);
  });

  it('rechaza un tipo de comprobante que no sea de exportación', () => {
    const result = issueExportVoucherSchema.safeParse(
      input({ voucherType: VoucherType.FACTURA_A }),
    );

    expect(result.success).toBe(false);
  });

  it('exige el CUIT país del destino', () => {
    expect(
      issueExportVoucherSchema.safeParse(input({ countryTaxId: '123' })).success,
    ).toBe(false);
  });

  it('suma el total descontando bonificaciones', () => {
    expect(
      exportVoucherTotal([
        { quantity: 10, unitPrice: 100, discount: 250 },
        { quantity: 2, unitPrice: 50, discount: 0 },
      ]),
    ).toBe(850);
  });

  it('la bonificación por defecto es cero', () => {
    const parsed = issueExportVoucherSchema.parse(input());

    expect(parsed.items[0].discount).toBe(0);
  });
});
