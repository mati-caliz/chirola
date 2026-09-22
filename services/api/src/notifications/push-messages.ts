import { describeVoucher } from '../vouchers/pdf.util';
import type { PushMessage } from './push-notification.service';

const MAX_REASON_LENGTH = 140;

export const CERTIFICATE_EXPIRY_PUSH_DAYS: readonly number[] = [30, 15, 7, 3, 1];

export function queuedVoucherAuthorizedMessage(voucher: {
  id: string;
  voucherType: number;
  salesPoint: number;
  number: number;
}): PushMessage {
  return {
    title: 'Comprobante autorizado',
    body: `${describeVoucher(voucher.voucherType, voucher.salesPoint, voucher.number)} ya tiene CAE: ARCA lo aprobó en el reintento.`,
    data: { voucherId: voucher.id },
  };
}

export function queuedVoucherFailedMessage(pendingVoucherId: string, reason: string): PushMessage {
  const shortReason =
    reason.length > MAX_REASON_LENGTH ? `${reason.slice(0, MAX_REASON_LENGTH)}…` : reason;
  return {
    title: 'No se pudo emitir un comprobante',
    body: `Quedó sin CAE: ${shortReason}`,
    data: { pendingVoucherId },
  };
}

export function certificateExpiringMessage(issuerId: string, daysToExpiry: number): PushMessage {
  const when = daysToExpiry === 1 ? 'mañana' : `en ${daysToExpiry} días`;
  return {
    title: 'Tu certificado de ARCA vence pronto',
    body: `Vence ${when}. Renovalo para seguir facturando.`,
    data: { issuerId },
  };
}
