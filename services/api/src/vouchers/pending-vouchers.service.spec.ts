import type { PendingVoucher } from "@prisma/client";
import { DocumentType, PendingVoucherStatus, VoucherConcept, VoucherType } from "@chirola/shared";
import { summarizePendingVoucher } from "./pending-vouchers.service";

function pendingVoucher(overrides: Partial<PendingVoucher> = {}): PendingVoucher {
  return {
    id: "pending-1",
    issuerId: "issuer-1",
    idempotencyKey: null,
    payload: {
      issuerId: "issuer-1",
      salesPoint: 2,
      voucherType: VoucherType.FACTURA_B,
      concept: VoucherConcept.PRODUCTS,
      recipient: { docType: DocumentType.CONSUMIDOR_FINAL, docNumber: "0", legalName: "Juana" },
      items: [{ description: "Café", quantity: 2, unitPrice: 1500, ivaRate: 21 }],
      currency: "PES",
      exchangeRate: 1,
    },
    status: PendingVoucherStatus.FAILED,
    retryCount: 8,
    nextRetryAt: new Date("2026-09-22T12:00:00Z"),
    attemptedNumber: null,
    attemptedSalesPoint: null,
    attemptedAt: null,
    lastError: "ARCA no respondió",
    createdAt: new Date("2026-09-22T10:00:00Z"),
    updatedAt: new Date("2026-09-22T12:00:00Z"),
    ...overrides,
  };
}

describe("summarizePendingVoucher", () => {
  it("resume el comprobante encolado con su total y el último error", () => {
    expect(summarizePendingVoucher(pendingVoucher())).toEqual({
      id: "pending-1",
      status: PendingVoucherStatus.FAILED,
      voucherType: VoucherType.FACTURA_B,
      salesPoint: 2,
      recipientName: "Juana",
      totalAmount: 3000,
      currency: "PES",
      retryCount: 8,
      nextRetryAt: "2026-09-22T12:00:00.000Z",
      lastError: "ARCA no respondió",
      createdAt: "2026-09-22T10:00:00.000Z",
    });
  });
});
