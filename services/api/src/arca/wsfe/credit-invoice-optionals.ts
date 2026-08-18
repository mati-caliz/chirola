import { BadRequestException } from '@nestjs/common';
import {
  ArcaOptionalType,
  CANCELLATION_NO,
  isCreditDebitNote,
  isCreditInvoice,
  TransmissionType,
  type TransmissionTypeName,
} from '@chirola/shared';
import type { ArcaOptional } from './wsfe.types';

export interface PaymentAccountHolder {
  cbu: string | null;
  paymentAlias: string | null;
}

export function buildCreditInvoiceOptionals(
  voucherType: number,
  issuer: PaymentAccountHolder,
  transmissionType?: TransmissionTypeName,
): ArcaOptional[] {
  if (!isCreditInvoice(voucherType)) {
    return [];
  }

  if (isCreditDebitNote(voucherType)) {
    return [{ id: ArcaOptionalType.CANCELLATION, value: CANCELLATION_NO }];
  }

  if (!issuer.cbu) {
    throw new BadRequestException(
      'Para emitir una Factura de Crédito Electrónica MiPyME hay que cargar el CBU del emisor.',
    );
  }

  const optionals: ArcaOptional[] = [
    { id: ArcaOptionalType.CBU, value: issuer.cbu },
    {
      id: ArcaOptionalType.TRANSMISSION_TYPE,
      value: transmissionType ?? TransmissionType.OPEN_CIRCULATION,
    },
  ];

  if (issuer.paymentAlias) {
    optionals.push({
      id: ArcaOptionalType.PAYMENT_ALIAS,
      value: issuer.paymentAlias,
    });
  }

  return optionals;
}
