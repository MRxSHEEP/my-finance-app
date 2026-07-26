-- CreateTable
CREATE TABLE "ModelPortfolio" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModelPortfolio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModelPortfolioHolding" (
    "id" TEXT NOT NULL,
    "modelPortfolioId" TEXT NOT NULL,
    "assetType" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "name" TEXT,
    "targetWeightPercent" DOUBLE PRECISION NOT NULL,
    "priceAtCreation" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModelPortfolioHolding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModelPortfolioSnapshot" (
    "id" TEXT NOT NULL,
    "modelPortfolioId" TEXT NOT NULL,
    "asOfDate" TIMESTAMP(3) NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModelPortfolioSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModelPortfolioShareLink" (
    "id" TEXT NOT NULL,
    "modelPortfolioId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModelPortfolioShareLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ModelPortfolio_organizationId_createdByUserId_idx" ON "ModelPortfolio"("organizationId", "createdByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "ModelPortfolioHolding_modelPortfolioId_assetType_symbol_key" ON "ModelPortfolioHolding"("modelPortfolioId", "assetType", "symbol");

-- CreateIndex
CREATE UNIQUE INDEX "ModelPortfolioSnapshot_modelPortfolioId_asOfDate_key" ON "ModelPortfolioSnapshot"("modelPortfolioId", "asOfDate");

-- CreateIndex
CREATE UNIQUE INDEX "ModelPortfolioShareLink_modelPortfolioId_key" ON "ModelPortfolioShareLink"("modelPortfolioId");

-- CreateIndex
CREATE UNIQUE INDEX "ModelPortfolioShareLink_token_key" ON "ModelPortfolioShareLink"("token");

-- AddForeignKey
ALTER TABLE "ModelPortfolio" ADD CONSTRAINT "ModelPortfolio_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModelPortfolioHolding" ADD CONSTRAINT "ModelPortfolioHolding_modelPortfolioId_fkey" FOREIGN KEY ("modelPortfolioId") REFERENCES "ModelPortfolio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModelPortfolioSnapshot" ADD CONSTRAINT "ModelPortfolioSnapshot_modelPortfolioId_fkey" FOREIGN KEY ("modelPortfolioId") REFERENCES "ModelPortfolio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModelPortfolioShareLink" ADD CONSTRAINT "ModelPortfolioShareLink_modelPortfolioId_fkey" FOREIGN KEY ("modelPortfolioId") REFERENCES "ModelPortfolio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

