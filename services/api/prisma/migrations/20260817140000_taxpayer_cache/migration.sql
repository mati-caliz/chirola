-- CreateTable
CREATE TABLE "TaxpayerCache" (
    "id" TEXT NOT NULL,
    "cuit" TEXT NOT NULL,
    "legalName" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "ivaConditionId" INTEGER NOT NULL,
    "address" JSONB,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaxpayerCache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TaxpayerCache_cuit_key" ON "TaxpayerCache"("cuit");
