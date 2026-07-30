-- CreateTable
CREATE TABLE "EarningsSetupAnalysis" (
    "id" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "reportDate" TIMESTAMP(3) NOT NULL,
    "dataSnapshot" JSONB NOT NULL,
    "citedFacts" JSONB NOT NULL,
    "narrative" TEXT,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EarningsSetupAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EarningsSetupAnalysis_ticker_reportDate_key" ON "EarningsSetupAnalysis"("ticker", "reportDate");

