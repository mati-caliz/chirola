const CENTS_PER_UNIT = 100;

export function roundToCents(amount: number): number {
  return Math.round((amount + Number.EPSILON) * CENTS_PER_UNIT) / CENTS_PER_UNIT;
}
