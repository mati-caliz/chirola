-- CreateTable
CREATE TABLE "ApiClient" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApiClient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiClientIssuer" (
    "id" TEXT NOT NULL,
    "apiClientId" TEXT NOT NULL,
    "issuerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiClientIssuer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ApiClient_name_key" ON "ApiClient"("name");

-- CreateIndex
CREATE INDEX "ApiClientIssuer_issuerId_idx" ON "ApiClientIssuer"("issuerId");

-- CreateIndex
CREATE UNIQUE INDEX "ApiClientIssuer_apiClientId_issuerId_key" ON "ApiClientIssuer"("apiClientId", "issuerId");

-- AddForeignKey
ALTER TABLE "ApiClientIssuer" ADD CONSTRAINT "ApiClientIssuer_apiClientId_fkey" FOREIGN KEY ("apiClientId") REFERENCES "ApiClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

