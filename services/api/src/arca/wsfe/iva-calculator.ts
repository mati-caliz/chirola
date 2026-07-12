import {
  ivaRateAfipId,
  requiresRecipientCuit,
  type Item,
} from '@chirola/shared';
import type { ArcaIvaRate, VoucherAmounts } from './wsfe.types';

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function calculateAmounts(
  voucherType: number,
  items: Item[],
): VoucherAmounts {
  const totalAmount = round2(
    items.reduce((acc, it) => acc + it.quantity * it.unitPrice, 0),
  );

  if (!requiresRecipientCuit(voucherType)) {
    return { netAmount: totalAmount, ivaAmount: 0, totalAmount, rates: [] };
  }

  const grossByRate = new Map<number, number>();
  for (const it of items) {
    const gross = it.quantity * it.unitPrice;
    grossByRate.set(
      it.ivaRate,
      (grossByRate.get(it.ivaRate) ?? 0) + gross,
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

  return { netAmount, ivaAmount, totalAmount, rates };
}
