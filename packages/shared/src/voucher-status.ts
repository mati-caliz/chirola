export const VoucherStatus = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  RECOVERED: 'RECOVERED',
  OBSERVED: 'OBSERVED',
  REJECTED: 'REJECTED',
} as const;

export type VoucherStatusName =
  (typeof VoucherStatus)[keyof typeof VoucherStatus];

export const voucherStatusName: Record<VoucherStatusName, string> = {
  PENDING: 'Pendiente',
  APPROVED: 'Autorizado',
  RECOVERED: 'Recuperado de ARCA',
  OBSERVED: 'Autorizado con observaciones',
  REJECTED: 'Rechazado',
};

export function describeVoucherStatus(status: string): string {
  const known = Object.entries(voucherStatusName).find(([key]) => key === status);
  return known ? known[1] : status;
}

export const authorizedVoucherStatuses: readonly VoucherStatusName[] = [
  VoucherStatus.APPROVED,
  VoucherStatus.RECOVERED,
  VoucherStatus.OBSERVED,
];

export function isAuthorizedStatus(status: string): boolean {
  return (authorizedVoucherStatuses as readonly string[]).includes(status);
}

export const PendingVoucherStatus = {
  PENDING: 'PENDING',
  FAILED: 'FAILED',
} as const;

export type PendingVoucherStatusName =
  (typeof PendingVoucherStatus)[keyof typeof PendingVoucherStatus];
