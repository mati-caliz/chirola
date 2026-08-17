-- AlterTable
ALTER TABLE "Voucher" ADD COLUMN     "serviceFrom" TIMESTAMP(3),
ADD COLUMN     "serviceTo" TIMESTAMP(3),
ADD COLUMN     "paymentDueDate" TIMESTAMP(3);
