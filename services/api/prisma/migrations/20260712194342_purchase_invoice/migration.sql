-- CreateTable
CREATE TABLE "PurchaseInvoice" (
    "id" TEXT NOT NULL,
    "issuerId" TEXT NOT NULL,
    "supplierCuit" TEXT NOT NULL,
    "supplierName" TEXT NOT NULL,
    "invoiceType" INTEGER NOT NULL,
    "salesPoint" INTEGER NOT NULL,
    "number" INTEGER NOT NULL,
    "issueDate" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3),
    "netAmount21" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "iva21" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "netAmount105" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "iva105" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "netAmount27" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "iva27" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "exempt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "untaxed" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(15,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PurchaseInvoice_issuerId_issueDate_idx" ON "PurchaseInvoice"("issuerId", "issueDate");

-- AddForeignKey
ALTER TABLE "PurchaseInvoice" ADD CONSTRAINT "PurchaseInvoice_issuerId_fkey" FOREIGN KEY ("issuerId") REFERENCES "Issuer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

