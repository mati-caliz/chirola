export const WebhookEvent = {
  VOUCHER_ISSUED: 'voucher.issued',
  VOUCHER_FAILED: 'voucher.failed',
  CERTIFICATE_EXPIRING: 'certificate.expiring',
} as const;

export type WebhookEventType = (typeof WebhookEvent)[keyof typeof WebhookEvent];

export const SIGNATURE_HEADER = 'x-chirola-signature';
export const EVENT_HEADER = 'x-chirola-event';
