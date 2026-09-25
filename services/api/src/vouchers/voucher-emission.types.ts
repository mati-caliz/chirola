import type { ArcaIssuer } from "../arca/arca-environment";
import type { CaeResult, VoucherAmounts } from "../arca/wsfe/wsfe.types";

export type EmissionIssuer = ArcaIssuer & {
  cbu: string | null;
  paymentAlias: string | null;
};

export type StoredIssuer = EmissionIssuer & { userId: string };

export interface EmissionOutcome {
  cae: CaeResult;
  number: number;
  amounts: VoucherAmounts;
  date: Date;
  recovered: boolean;
}

export interface IssuedVoucher {
  id: string;
  voucherType: number;
  salesPoint: number;
  number: number;
  cae: string;
  caeExpiration: Date;
  netAmount: number;
  ivaAmount: number;
  totalAmount: number;
  qrData: string;
}

export function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
