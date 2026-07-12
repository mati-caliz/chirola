import type { AssociatedVoucher, Item } from '@chirola/shared';

export interface AuthContext {
  cuit: string;
  token: string;
  sign: string;
}

export interface ArcaIvaRate {

  id: number;

  taxableBase: number;

  amount: number;
}

export interface VoucherAmounts {
  netAmount: number;
  ivaAmount: number;
  totalAmount: number;

  rates: ArcaIvaRate[];
}

export interface CaeRequest {
  salesPoint: number;
  voucherType: number;

  concept: number;
  number: number;
  date: Date;
  recipient: {
    docType: number;
    docNumber: string;

    ivaConditionId: number;
  };
  amounts: VoucherAmounts;
  currency: string;
  exchangeRate: number;

  associatedVouchers?: AssociatedVoucher[];
}

export interface CaeResult {
  cae: string;
  caeVto: Date;
}

export interface SalesPointInfo {
  number: number;
  emissionType: string;
}

export interface VoucherCalculationInput {
  voucherType: number;
  items: Item[];
}
