import { BadRequestException } from '@nestjs/common';
import {
  ArcaOptionalType,
  CANCELLATION_NO,
  TransmissionType,
  VoucherType,
} from '@chirola/shared';
import { buildCreditInvoiceOptionals } from './credit-invoice-optionals';

const issuerWithCbu = {
  cbu: '2850590940090418135201',
  paymentAlias: null,
};

describe('buildCreditInvoiceOptionals (C.2)', () => {
  it('no agrega opcionales a un comprobante que no es FCE', () => {
    expect(
      buildCreditInvoiceOptionals(VoucherType.FACTURA_A, issuerWithCbu),
    ).toEqual([]);
  });

  it('informa CBU y tipo de transmisión en la FCE', () => {
    expect(
      buildCreditInvoiceOptionals(VoucherType.FCE_FACTURA_A, issuerWithCbu),
    ).toEqual([
      { id: ArcaOptionalType.CBU, value: issuerWithCbu.cbu },
      {
        id: ArcaOptionalType.TRANSMISSION_TYPE,
        value: TransmissionType.OPEN_CIRCULATION,
      },
    ]);
  });

  it('respeta el tipo de transmisión elegido', () => {
    const optionals = buildCreditInvoiceOptionals(
      VoucherType.FCE_FACTURA_B,
      issuerWithCbu,
      TransmissionType.COLLECTIVE_DEPOSIT,
    );

    expect(optionals).toContainEqual({
      id: ArcaOptionalType.TRANSMISSION_TYPE,
      value: TransmissionType.COLLECTIVE_DEPOSIT,
    });
  });

  it('agrega el alias sólo si el emisor lo tiene cargado', () => {
    const optionals = buildCreditInvoiceOptionals(VoucherType.FCE_FACTURA_C, {
      cbu: issuerWithCbu.cbu,
      paymentAlias: 'acme.pagos.arca',
    });

    expect(optionals).toContainEqual({
      id: ArcaOptionalType.PAYMENT_ALIAS,
      value: 'acme.pagos.arca',
    });
  });

  it('rechaza emitir una FCE si el emisor no tiene CBU', () => {
    expect(() =>
      buildCreditInvoiceOptionals(VoucherType.FCE_FACTURA_A, {
        cbu: null,
        paymentAlias: null,
      }),
    ).toThrow(BadRequestException);
  });

  it('las NC/ND de FCE informan la marca de anulación en vez del CBU', () => {
    expect(
      buildCreditInvoiceOptionals(VoucherType.FCE_NOTA_CREDITO_A, {
        cbu: null,
        paymentAlias: null,
      }),
    ).toEqual([{ id: ArcaOptionalType.CANCELLATION, value: CANCELLATION_NO }]);
  });
});
