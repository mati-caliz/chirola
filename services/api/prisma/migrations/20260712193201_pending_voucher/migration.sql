-- CreateTable
CREATE TABLE "PendingVoucher" (
    "id" TEXT NOT NULL,
    "issuerId" TEXT NOT NULL,
    "idempotencyKey" TEXT,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "nextRetryAt" TIMESTAMP(3) NOT NULL,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PendingVoucher_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PendingVoucher_status_nextRetryAt_idx" ON "PendingVoucher"("status", "nextRetryAt");

-- CreateIndex
CREATE UNIQUE INDEX "PendingVoucher_issuerId_idempotencyKey_key" ON "PendingVoucher"("issuerId", "idempotencyKey");

