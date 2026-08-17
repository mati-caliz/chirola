import {
  ivaRateAfipId,
  requiresRecipientCuit,
  TaxTreatment,
  type Item,
  type Tribute,
} from '@chirola/shared';
import type { ArcaIvaRate, ArcaTribute, VoucherAmounts } from './wsfe.types';

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function grossOf(item: Item): number {
  return item.quantity * item.unitPrice;
}

function sumBy(items: Item[], treatment: string): number {
  return round2(
    items
      .filter((item) => item.taxTreatment === treatment)
      .reduce((acc, item) => acc + grossOf(item), 0),
  );
}

function calculateTributes(tributes: Tribute[]): {
  entries: ArcaTribute[];
  total: number;
} {
  const entries = tributes.map((tribute) => ({
    id: tribute.id,
    description: tribute.description,
    taxableBase: round2(tribute.taxableBase),
    rate: tribute.rate,
    amount: round2((tribute.taxableBase * tribute.rate) / 100),
  }));
  const total = round2(entries.reduce((acc, entry) => acc + entry.amount, 0));
  return { entries, total };
}

export function calculateAmounts(
  voucherType: number,
  items: Item[],
  tributes: Tribute[] = [],
): VoucherAmounts {
  const { entries: tributeEntries, total: tributeAmount } =
    calculateTributes(tributes);
  const itemsTotal = round2(items.reduce((acc, item) => acc + grossOf(item), 0));
  const totalAmount = round2(itemsTotal + tributeAmount);

  if (!requiresRecipientCuit(voucherType)) {
    return {
      netAmount: itemsTotal,
      ivaAmount: 0,
      exemptAmount: 0,
      untaxedAmount: 0,
      tributeAmount,
      totalAmount,
      rates: [],
      tributes: tributeEntries,
    };
  }

  const exemptAmount = sumBy(items, TaxTreatment.EXEMPT);
  const untaxedAmount = sumBy(items, TaxTreatment.UNTAXED);

  const grossByRate = new Map<number, number>();
  for (const item of items) {
    if (item.taxTreatment !== TaxTreatment.TAXED) continue;
    grossByRate.set(
      item.ivaRate,
      (grossByRate.get(item.ivaRate) ?? 0) + grossOf(item),
    );
  }

  const rates: ArcaIvaRate[] = [];
  let netAmount = 0;
  let ivaAmount = 0;

  for (const [rate, rawGross] of grossByRate) {
    const gross = round2(rawGross);
    const taxableBase = round2(gross / (1 + rate / 100));
    const amount = round2(gross - taxableBase);
    netAmount = round2(netAmount + taxableBase);
    ivaAmount = round2(ivaAmount + amount);

    const id = ivaRateAfipId[rate];
    if (id === undefined) {
      throw new Error(`Alícuota de IVA no mapeada a Id de ARCA: ${rate}`);
    }
    rates.push({ id, taxableBase, amount });
  }

  return {
    netAmount,
    ivaAmount,
    exemptAmount,
    untaxedAmount,
    tributeAmount,
    totalAmount,
    rates,
    tributes: tributeEntries,
  };
}
