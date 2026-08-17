import { RecipientIvaCondition } from './recipient-iva-condition';

export const ArcaTaxId = {
  VAT: 30,
  MONOTRIBUTO: 20,
  VAT_EXEMPT: 32,
} as const;

export const TaxpayerStatus = {
  ACTIVE: 'ACTIVO',
  INACTIVE: 'INACTIVO',
} as const;

export type TaxpayerAddress = {
  street: string | null;
  city: string | null;
  postalCode: string | null;
  province: string | null;
};

export interface TaxpayerInfo {
  cuit: string;
  legalName: string;
  status: string;
  ivaConditionId: number;
  address: TaxpayerAddress | null;
}

export function inferRecipientIvaCondition(padron: {
  taxIds: readonly number[];
  hasMonotributo: boolean;
}): number {
  if (padron.hasMonotributo || padron.taxIds.includes(ArcaTaxId.MONOTRIBUTO)) {
    return RecipientIvaCondition.MONOTRIBUTO;
  }
  if (padron.taxIds.includes(ArcaTaxId.VAT)) {
    return RecipientIvaCondition.RESPONSABLE_INSCRIPTO;
  }
  if (padron.taxIds.includes(ArcaTaxId.VAT_EXEMPT)) {
    return RecipientIvaCondition.SUJETO_EXENTO;
  }
  return RecipientIvaCondition.CONSUMIDOR_FINAL;
}
