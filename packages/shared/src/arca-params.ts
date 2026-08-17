import { z } from 'zod';
import { documentTypeName } from './document-type';
import { ivaRates, ivaRateAfipId } from './iva-rate';
import { recipientIvaConditionName } from './recipient-iva-condition';
import { tributeTypeName } from './tribute-type';
import { voucherTypeName } from './voucher-type';

export const ArcaParamType = {
  VOUCHER_TYPES: 'VOUCHER_TYPES',
  DOCUMENT_TYPES: 'DOCUMENT_TYPES',
  IVA_RATES: 'IVA_RATES',
  TRIBUTE_TYPES: 'TRIBUTE_TYPES',
  OPTIONAL_TYPES: 'OPTIONAL_TYPES',
  RECIPIENT_IVA_CONDITIONS: 'RECIPIENT_IVA_CONDITIONS',
} as const;

export type ArcaParamTypeName =
  (typeof ArcaParamType)[keyof typeof ArcaParamType];

export const arcaParamTypeSchema = z.enum([
  ArcaParamType.VOUCHER_TYPES,
  ArcaParamType.DOCUMENT_TYPES,
  ArcaParamType.IVA_RATES,
  ArcaParamType.TRIBUTE_TYPES,
  ArcaParamType.OPTIONAL_TYPES,
  ArcaParamType.RECIPIENT_IVA_CONDITIONS,
]);

export type ArcaParam = {
  id: number;
  description: string;
};

function fromNameMap(names: Record<number, string>): ArcaParam[] {
  return Object.entries(names).map(([id, description]) => ({
    id: Number(id),
    description,
  }));
}

export const localArcaParams: Record<ArcaParamTypeName, ArcaParam[]> = {
  VOUCHER_TYPES: fromNameMap(voucherTypeName),
  DOCUMENT_TYPES: fromNameMap(documentTypeName),
  IVA_RATES: ivaRates.map((rate) => ({
    id: ivaRateAfipId[rate],
    description: `${rate}%`,
  })),
  TRIBUTE_TYPES: fromNameMap(tributeTypeName),
  OPTIONAL_TYPES: [],
  RECIPIENT_IVA_CONDITIONS: fromNameMap(recipientIvaConditionName),
};
