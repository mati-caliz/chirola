import type { StoredIssuer } from "./voucher-emission.types";
import type { IssuerScope, VoucherAccessTables, VoucherDetail, VoucherScope } from "./voucher-tables";

export interface AccessTablesContent {
  issuers: readonly StoredIssuer[];
  vouchers: readonly VoucherDetail[];
  findMany: VoucherAccessTables["voucher"]["findMany"];
}

function matchesIssuerScope(issuer: StoredIssuer, where: IssuerScope): boolean {
  return issuer.id === where.id && (where.userId === undefined || issuer.userId === where.userId);
}

function matchesVoucherScope(voucher: VoucherDetail, where: VoucherScope): boolean {
  if (voucher.id !== where.id) {
    return false;
  }
  return "issuerId" in where
    ? voucher.issuerId === where.issuerId
    : voucher.issuer.userId === where.issuer.userId;
}

export function buildAccessTables({ issuers, vouchers, findMany }: AccessTablesContent): VoucherAccessTables {
  return {
    issuer: {
      findFirst: ({ where }) =>
        Promise.resolve(issuers.find((issuer) => matchesIssuerScope(issuer, where)) ?? null),
      count: ({ where }) => Promise.resolve(issuers.filter((issuer) => issuer.id === where.id).length),
    },
    voucher: {
      findFirst: ({ where }) =>
        Promise.resolve(vouchers.find((voucher) => matchesVoucherScope(voucher, where)) ?? null),
      findUnique: ({ where }) => {
        const voucher = vouchers.find((candidate) => candidate.id === where.id);
        return Promise.resolve(voucher === undefined ? null : { issuerId: voucher.issuerId });
      },
      findMany,
    },
  };
}
