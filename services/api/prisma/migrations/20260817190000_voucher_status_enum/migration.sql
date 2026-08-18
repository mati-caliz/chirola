UPDATE "Voucher" SET "status" = 'APPROVED' WHERE "status" = 'AUTORIZADO';
UPDATE "Voucher" SET "status" = 'PENDING' WHERE "status" = 'PENDIENTE';
UPDATE "Voucher" SET "status" = 'OBSERVED' WHERE "status" = 'OBSERVADO';
UPDATE "Voucher" SET "status" = 'REJECTED' WHERE "status" = 'RECHAZADO';

UPDATE "PendingVoucher" SET "status" = 'PENDING' WHERE "status" = 'PENDIENTE';
UPDATE "PendingVoucher" SET "status" = 'FAILED' WHERE "status" = 'ERROR';

ALTER TABLE "Voucher" ALTER COLUMN "status" SET DEFAULT 'PENDING';
ALTER TABLE "PendingVoucher" ALTER COLUMN "status" SET DEFAULT 'PENDING';
