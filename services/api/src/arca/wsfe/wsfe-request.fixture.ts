import type { CaeRequest } from "./wsfe.types";

const ISSUE_YEAR = 2026;
const JULY = 6;
const ISSUE_DAY = 12;

export function baseCaeRequest(overrides: Partial<CaeRequest> = {}): CaeRequest {
  return {
    salesPoint: 1,
    voucherType: 8,
    concept: 1,
    number: 5,
    date: new Date(ISSUE_YEAR, JULY, ISSUE_DAY),
    recipient: { docType: 80, docNumber: "20111111112", ivaConditionId: 1 },
    amounts: {
      netAmount: 100,
      ivaAmount: 0,
      exemptAmount: 0,
      untaxedAmount: 0,
      tributeAmount: 0,
      totalAmount: 100,
      rates: [],
      tributes: [],
    },
    currency: "PES",
    exchangeRate: 1,
    ...overrides,
  };
}
