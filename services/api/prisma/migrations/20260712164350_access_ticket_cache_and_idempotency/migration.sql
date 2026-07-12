-- Reconcile Voucher column left unrenamed by 20260712150000_rename_to_english
ALTER TABLE "Voucher" RENAME COLUMN "numero" TO "number";

-- CreateTable
CREATE TABLE "AccessTicketCache" (
    "id" TEXT NOT NULL,
    "issuerId" TEXT NOT NULL,
    "service" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "sign" TEXT NOT NULL,
    "generation" TIMESTAMP(3) NOT NULL,
    "expiration" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccessTicketCache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdempotencyRecord" (
    "id" TEXT NOT NULL,
    "issuerId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "voucherId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdempotencyRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AccessTicketCache_issuerId_service_key" ON "AccessTicketCache"("issuerId", "service");

-- CreateIndex
CREATE UNIQUE INDEX "IdempotencyRecord_issuerId_key_key" ON "IdempotencyRecord"("issuerId", "key");
