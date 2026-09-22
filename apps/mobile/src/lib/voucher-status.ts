import { VoucherStatus } from '@chirola/shared';
import { type StatusKey } from '@/theme/tokens';

const statusKeyByVoucherStatus: Record<string, StatusKey> = {
  [VoucherStatus.APPROVED]: 'aprobado',
  [VoucherStatus.RECOVERED]: 'aprobado',
  [VoucherStatus.OBSERVED]: 'observado',
  [VoucherStatus.REJECTED]: 'rechazado',
  [VoucherStatus.PENDING]: 'pendiente',
};

export function voucherStatusKey(status: string): StatusKey {
  return statusKeyByVoucherStatus[status] ?? 'pendiente';
}
