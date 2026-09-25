import { z } from "zod";

export const pendingVoucherSummarySchema = z.object({
  id: z.string(),
  status: z.string(),
  voucherType: z.number(),
  salesPoint: z.number(),
  recipientName: z.string().nullable(),
  totalAmount: z.number(),
  currency: z.string(),
  retryCount: z.number(),
  nextRetryAt: z.string(),
  lastError: z.string().nullable(),
  createdAt: z.string(),
});

export type PendingVoucherSummary = z.infer<typeof pendingVoucherSummarySchema>;
