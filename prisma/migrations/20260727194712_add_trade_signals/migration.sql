-- CreateTable
CREATE TABLE "TradeSignal" (
    "id" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "companyName" TEXT,
    "direction" TEXT NOT NULL,
    "confidence" INTEGER NOT NULL,
    "rationale" TEXT NOT NULL,
    "dataSnapshot" JSONB NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TradeSignal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TradeSignal_ticker_key" ON "TradeSignal"("ticker");

-- CreateIndex
CREATE INDEX "TradeSignal_generatedAt_idx" ON "TradeSignal"("generatedAt");

