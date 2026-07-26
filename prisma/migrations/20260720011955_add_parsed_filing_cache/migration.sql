-- CreateTable
CREATE TABLE "ParsedFilingCache" (
    "id" TEXT NOT NULL,
    "chamber" TEXT NOT NULL,
    "filingId" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "filerName" TEXT,
    "disclosureDate" TIMESTAMP(3),
    "parsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usedOcr" BOOLEAN NOT NULL DEFAULT false,
    "transactionCount" INTEGER NOT NULL,
    "unparsedCount" INTEGER NOT NULL DEFAULT 0,
    "unparsedDetail" JSONB,
    "needsReview" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ParsedFilingCache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ParsedFilingCache_needsReview_idx" ON "ParsedFilingCache"("needsReview");

-- CreateIndex
CREATE UNIQUE INDEX "ParsedFilingCache_chamber_filingId_key" ON "ParsedFilingCache"("chamber", "filingId");
