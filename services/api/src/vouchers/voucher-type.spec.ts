import {
  discriminatesIva,
  FiscalCondition,
  inferFiscalCondition,
  isCreditNote,
  issuableInvoiceTypes,
  requiresRecipientCuit,
  requiresRetentionNotice,
  voucherLetter,
  VoucherType,
} from '@chirola/shared';

describe('tipos de comprobante M (C.1)', () => {
  it('reconoce la letra M', () => {
    expect(voucherLetter(VoucherType.FACTURA_M)).toBe('M');
    expect(voucherLetter(VoucherType.NOTA_CREDITO_M)).toBe('M');
  });

  it('la M discrimina IVA como la A', () => {
    expect(discriminatesIva(VoucherType.FACTURA_M)).toBe(true);
    expect(discriminatesIva(VoucherType.FACTURA_A)).toBe(true);
    expect(discriminatesIva(VoucherType.FACTURA_B)).toBe(false);
    expect(discriminatesIva(VoucherType.FACTURA_C)).toBe(false);
  });

  it('la M exige identificar al receptor con CUIT', () => {
    expect(requiresRecipientCuit(VoucherType.FACTURA_M)).toBe(true);
  });

  it('sólo la M lleva la leyenda de retención', () => {
    expect(requiresRetentionNotice(VoucherType.FACTURA_M)).toBe(true);
    expect(requiresRetentionNotice(VoucherType.NOTA_CREDITO_M)).toBe(true);
    expect(requiresRetentionNotice(VoucherType.FACTURA_A)).toBe(false);
  });

  it('reconoce la nota de crédito M', () => {
    expect(isCreditNote(VoucherType.NOTA_CREDITO_M)).toBe(true);
    expect(isCreditNote(VoucherType.NOTA_DEBITO_M)).toBe(false);
  });

  it('incluye la M entre las facturas emitibles', () => {
    expect(issuableInvoiceTypes).toContain(VoucherType.FACTURA_M);
  });
});

describe('inferFiscalCondition con Factura M (C.1)', () => {
  it('detecta al emisor habilitado a M aunque también tenga B', () => {
    expect(
      inferFiscalCondition([VoucherType.FACTURA_M, VoucherType.FACTURA_B]),
    ).toBe(FiscalCondition.RESPONSABLE_INSCRIPTO_M);
  });

  it('sigue detectando al responsable inscripto sin M', () => {
    expect(
      inferFiscalCondition([VoucherType.FACTURA_A, VoucherType.FACTURA_B]),
    ).toBe(FiscalCondition.RESPONSABLE_INSCRIPTO);
  });

  it('sigue detectando al monotributista', () => {
    expect(inferFiscalCondition([VoucherType.FACTURA_C])).toBe(
      FiscalCondition.MONOTRIBUTISTA,
    );
  });
});
