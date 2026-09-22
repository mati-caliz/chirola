import { isCreditNote, TaxTreatment, voucherLetter } from '@chirola/shared';

export type Numeric = number | { toString(): string };

export interface TaxBreakdownItem {
  ivaRate: Numeric;
  subtotal: Numeric;
  taxTreatment?: string;
}

export interface TaxBreakdownVoucher {
  voucherType: number;
  exchangeRate?: Numeric;
  items: TaxBreakdownItem[];
}

export interface VoucherTaxBreakdown {
  netAmount: number;
  exemptAmount: number;
  untaxedAmount: number;
  ivaByRate: Map<number, number>;
}

const IVA_BEARING_LETTERS: readonly string[] = ['A', 'B', 'M'];
const EXPORT_LETTER = 'E';
const LOCAL_EXCHANGE_RATE = 1;

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function bearsIva(voucherType: number): boolean {
  return IVA_BEARING_LETTERS.includes(voucherLetter(voucherType));
}

export function voucherSign(voucherType: number): number {
  return isCreditNote(voucherType) ? -1 : 1;
}

export function toPesos(voucher: TaxBreakdownVoucher, amount: number): number {
  const rate =
    voucher.exchangeRate === undefined ? LOCAL_EXCHANGE_RATE : Number(voucher.exchangeRate);
  return amount * rate;
}

function addTo(map: Map<number, number>, key: number, amount: number): void {
  map.set(key, (map.get(key) ?? 0) + amount);
}

export function breakDownVoucherTaxes(voucher: TaxBreakdownVoucher): VoucherTaxBreakdown {
  const ivaByRate = new Map<number, number>();
  let netAmount = 0;
  let exemptAmount = 0;
  let untaxedAmount = 0;
  const withIva = bearsIva(voucher.voucherType);
  const isExport = voucherLetter(voucher.voucherType) === EXPORT_LETTER;

  for (const item of voucher.items) {
    const gross = toPesos(voucher, Number(item.subtotal));
    const treatment = item.taxTreatment ?? TaxTreatment.TAXED;
    if (treatment === TaxTreatment.EXEMPT || isExport) {
      exemptAmount += gross;
      continue;
    }
    if (treatment === TaxTreatment.UNTAXED) {
      untaxedAmount += gross;
      continue;
    }
    const rate = Number(item.ivaRate);
    if (!withIva || rate === 0) {
      netAmount += gross;
      continue;
    }
    const base = gross / (1 + rate / 100);
    netAmount += base;
    addTo(ivaByRate, rate, gross - base);
  }

  for (const [rate, amount] of ivaByRate) {
    ivaByRate.set(rate, round2(amount));
  }
  return {
    netAmount: round2(netAmount),
    exemptAmount: round2(exemptAmount),
    untaxedAmount: round2(untaxedAmount),
    ivaByRate,
  };
}
