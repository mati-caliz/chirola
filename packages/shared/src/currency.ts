import { z } from "zod";

export const currencySchema = z.object({
  id: z.string(),
  description: z.string(),
});

export type Currency = z.infer<typeof currencySchema>;

export const exchangeRateSchema = z.object({
  currencyId: z.string(),
  rate: z.number(),
  date: z.string(),
});

export type ExchangeRate = z.infer<typeof exchangeRateSchema>;
