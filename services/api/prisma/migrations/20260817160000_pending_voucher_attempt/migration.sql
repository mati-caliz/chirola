-- AlterTable
ALTER TABLE "PendingVoucher" ADD COLUMN     "attemptedNumber" INTEGER,
ADD COLUMN     "attemptedSalesPoint" INTEGER,
ADD COLUMN     "attemptedAt" TIMESTAMP(3);
