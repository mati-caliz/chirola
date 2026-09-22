export interface PendingVoucherSummary {
  id: string;
  status: string;
  voucherType: number;
  salesPoint: number;
  recipientName: string | null;
  totalAmount: number;
  currency: string;
  retryCount: number;
  nextRetryAt: string;
  lastError: string | null;
  createdAt: string;
}
