-- El certificado de ARCA puede pertenecer a un representante y no al propio contribuyente.
-- Guardamos el CUIT del titular del certificado para poder verificar, en cada llamada,
-- que el emisor factura con el certificado que le corresponde.
ALTER TABLE "Issuer" ADD COLUMN "representativeCuit" TEXT;
ALTER TABLE "Certificate" ADD COLUMN "holderCuit" TEXT;

-- El error 600 de ARCA no distingue entre "no te delegaron el servicio" y "el contribuyente
-- esta inhabilitado para facturar", asi que hace falta recordar hasta donde llego cada emisor.
ALTER TABLE "Issuer" ADD COLUMN "onboardingStatus" TEXT NOT NULL DEFAULT 'PENDING_CERTIFICATE';

UPDATE "Issuer" SET "onboardingStatus" = 'PENDING_DELEGATION'
WHERE EXISTS (
  SELECT 1 FROM "Certificate" c
  WHERE c."issuerId" = "Issuer"."id" AND c."certPem" IS NOT NULL
);

UPDATE "Issuer" SET "onboardingStatus" = 'ISSUING_CONFIRMED'
WHERE EXISTS (
  SELECT 1 FROM "Voucher" v
  WHERE v."issuerId" = "Issuer"."id" AND v."cae" IS NOT NULL
);

-- El ticket de acceso lo emite ARCA para el certificado, no para el emisor: si un representante
-- factura por varios contribuyentes, un TA por emisor hace que ARCA rechace el segundo login.
ALTER TABLE "AccessTicketCache" ADD COLUMN "holderCuit" TEXT NOT NULL DEFAULT '';
ALTER TABLE "AccessTicketCache" ADD COLUMN "environment" TEXT NOT NULL DEFAULT 'homologacion';

UPDATE "AccessTicketCache" atc
SET "holderCuit" = i."cuit", "environment" = i."environment"
FROM "Issuer" i
WHERE i."id" = atc."issuerId";

DELETE FROM "AccessTicketCache" WHERE "holderCuit" = '';

DROP INDEX IF EXISTS "AccessTicketCache_issuerId_service_key";
ALTER TABLE "AccessTicketCache" DROP COLUMN "issuerId";
ALTER TABLE "AccessTicketCache" ALTER COLUMN "holderCuit" DROP DEFAULT;
ALTER TABLE "AccessTicketCache" ALTER COLUMN "environment" DROP DEFAULT;

-- Dos emisores distintos pueden compartir CUIT y entorno, asi que la nueva clave puede colisionar.
DELETE FROM "AccessTicketCache" a
USING "AccessTicketCache" b
WHERE a."holderCuit" = b."holderCuit"
  AND a."environment" = b."environment"
  AND a."service" = b."service"
  AND a."expiration" < b."expiration";

CREATE UNIQUE INDEX "AccessTicketCache_holderCuit_environment_service_key"
  ON "AccessTicketCache"("holderCuit", "environment", "service");
