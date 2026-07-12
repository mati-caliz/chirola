-- CreateTable
CREATE TABLE "ShadowComparison" (
    "id" TEXT NOT NULL,
    "apiClientId" TEXT NOT NULL,
    "issuerId" TEXT NOT NULL,
    "salesPoint" INTEGER NOT NULL,
    "voucherType" INTEGER NOT NULL,
    "matched" BOOLEAN NOT NULL,
    "differences" JSONB NOT NULL,
    "expected" JSONB NOT NULL,
    "computed" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShadowComparison_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ShadowComparison_issuerId_createdAt_idx" ON "ShadowComparison"("issuerId", "createdAt");

