-- CreateTable
CREATE TABLE "ServiceAuditLog" (
    "id" TEXT NOT NULL,
    "apiClientId" TEXT NOT NULL,
    "issuerId" TEXT,
    "method" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "voucherId" TEXT,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ServiceAuditLog_apiClientId_createdAt_idx" ON "ServiceAuditLog"("apiClientId", "createdAt");

