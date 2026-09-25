export const ivaRates = [0, 2.5, 5, 10.5, 21, 27] as const;

export type IvaRate = (typeof ivaRates)[number];

export const afipIdByIvaRate: Readonly<Record<IvaRate, number>> = {
  0: 3,
  2.5: 9,
  5: 8,
  10.5: 4,
  21: 5,
  27: 6,
};

export const ivaRateAfipId: Readonly<Record<number, number>> = afipIdByIvaRate;
