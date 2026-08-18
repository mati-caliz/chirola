CREATE TABLE "ArcaCallLog" (
    "id" TEXT NOT NULL,
    "issuerId" TEXT,
    "service" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "httpStatus" INTEGER NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "outcome" TEXT NOT NULL,
    "errorCodes" TEXT,
    "requestXml" TEXT NOT NULL,
    "responseXml" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArcaCallLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ArcaCallLog_issuerId_createdAt_idx" ON "ArcaCallLog"("issuerId", "createdAt");
CREATE INDEX "ArcaCallLog_createdAt_idx" ON "ArcaCallLog"("createdAt");
