-- CreateTable
CREATE TABLE "ArcaParamCache" (
    "id" TEXT NOT NULL,
    "issuerId" TEXT NOT NULL,
    "paramType" TEXT NOT NULL,
    "entries" JSONB NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArcaParamCache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ArcaParamCache_issuerId_paramType_key" ON "ArcaParamCache"("issuerId", "paramType");
