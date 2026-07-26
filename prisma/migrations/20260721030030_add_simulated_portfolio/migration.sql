-- CreateTable
CREATE TABLE "SimulatedPortfolio" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "startingBalance" DOUBLE PRECISION NOT NULL,
    "cashBalance" DOUBLE PRECISION NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "stripeCheckoutSessionId" TEXT,
    "stripePaymentIntentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SimulatedPortfolio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SimulatedHolding" (
    "id" TEXT NOT NULL,
    "portfolioId" TEXT NOT NULL,
    "assetType" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "name" TEXT,
    "quantity" DOUBLE PRECISION NOT NULL,
    "averageCostBasis" DOUBLE PRECISION NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SimulatedHolding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SimulatedTransaction" (
    "id" TEXT NOT NULL,
    "portfolioId" TEXT NOT NULL,
    "assetType" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "name" TEXT,
    "transactionType" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "totalValue" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SimulatedTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SimulatedPortfolioSnapshot" (
    "id" TEXT NOT NULL,
    "portfolioId" TEXT NOT NULL,
    "asOfDate" TIMESTAMP(3) NOT NULL,
    "totalValue" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SimulatedPortfolioSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SimulatedPortfolio_stripeCheckoutSessionId_key" ON "SimulatedPortfolio"("stripeCheckoutSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "SimulatedPortfolio_stripePaymentIntentId_key" ON "SimulatedPortfolio"("stripePaymentIntentId");

-- CreateIndex
CREATE INDEX "SimulatedPortfolio_userId_idx" ON "SimulatedPortfolio"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SimulatedHolding_portfolioId_assetType_symbol_key" ON "SimulatedHolding"("portfolioId", "assetType", "symbol");

-- CreateIndex
CREATE INDEX "SimulatedTransaction_portfolioId_idx" ON "SimulatedTransaction"("portfolioId");

-- CreateIndex
CREATE UNIQUE INDEX "SimulatedPortfolioSnapshot_portfolioId_asOfDate_key" ON "SimulatedPortfolioSnapshot"("portfolioId", "asOfDate");

-- AddForeignKey
ALTER TABLE "SimulatedPortfolio" ADD CONSTRAINT "SimulatedPortfolio_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SimulatedHolding" ADD CONSTRAINT "SimulatedHolding_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "SimulatedPortfolio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SimulatedTransaction" ADD CONSTRAINT "SimulatedTransaction_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "SimulatedPortfolio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SimulatedPortfolioSnapshot" ADD CONSTRAINT "SimulatedPortfolioSnapshot_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "SimulatedPortfolio"("id") ON DELETE CASCADE ON UPDATE CASCADE;
