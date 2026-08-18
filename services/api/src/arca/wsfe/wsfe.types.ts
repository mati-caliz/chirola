import type { AssociatedVoucher, Item, ServicePeriod } from '@chirola/shared';

export interface AuthContext {
  issuerId: string;
  cuit: string;
  token: string;
  sign: string;
  environment: string;
}

export interface ArcaIvaRate {

  id: number;

  taxableBase: number;

  amount: number;
}

export type ArcaTribute = {
  id: number;
  description: string;
  taxableBase: number;
  rate: number;
  amount: number;
};

export interface VoucherAmounts {
  netAmount: number;
  ivaAmount: number;
  exemptAmount: number;
  untaxedAmount: number;
  tributeAmount: number;
  totalAmount: number;

  rates: ArcaIvaRate[];
  tributes: ArcaTribute[];
}

export type ArcaOptional = {
  id: number;
  value: string;
};

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

  servicePeriod?: ServicePeriod;

  paymentDueDate?: string;

  optionals?: ArcaOptional[];
}

export type ArcaObservation = {
  code: string;
  message: string;
};

export interface CaeResult {
  cae: string;
  caeVto: Date;
  observations: ArcaObservation[];
}

export type ArcaParamEntry = {
  id: number;
  description: string;
};

export interface CurrencyInfo {
  id: string;
  description: string;
}

export interface ExchangeRateInfo {
  currencyId: string;
  rate: number;
  date: Date;
}

export interface AuthorizedVoucherDetail {
  cae: CaeResult;
  number: number;
  totalAmount: number;
  recipientDocType: number;
  recipientDocNumber: string;
  date: Date;
}

export interface SalesPointInfo {
  number: number;
  emissionType: string;
}

export interface VoucherCalculationInput {
  voucherType: number;
  items: Item[];
}
