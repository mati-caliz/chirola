-- AlterTable
ALTER TABLE "Voucher" ADD COLUMN     "exemptAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
ADD COLUMN     "untaxedAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
ADD COLUMN     "tributeAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
ADD COLUMN     "tributes" JSONB;

-- AlterTable
ALTER TABLE "VoucherItem" ADD COLUMN     "taxTreatment" TEXT NOT NULL DEFAULT 'TAXED';
