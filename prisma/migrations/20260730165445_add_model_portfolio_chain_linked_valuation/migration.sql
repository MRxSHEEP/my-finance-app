-- DropIndex
DROP INDEX "ModelPortfolioHolding_modelPortfolioId_assetType_symbol_key";

-- AlterTable
ALTER TABLE "ModelPortfolioHolding" ADD COLUMN     "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "effectiveTo" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ModelPortfolioHoldingSnapshot" (
    "id" TEXT NOT NULL,
    "modelPortfolioId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "asOfDate" TIMESTAMP(3) NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModelPortfolioHoldingSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ModelPortfolioHoldingSnapshot_modelPortfolioId_asOfDate_idx" ON "ModelPortfolioHoldingSnapshot"("modelPortfolioId", "asOfDate");

-- CreateIndex
CREATE UNIQUE INDEX "ModelPortfolioHoldingSnapshot_modelPortfolioId_symbol_asOfD_key" ON "ModelPortfolioHoldingSnapshot"("modelPortfolioId", "symbol", "asOfDate");

-- CreateIndex
CREATE INDEX "ModelPortfolioHolding_modelPortfolioId_effectiveFrom_idx" ON "ModelPortfolioHolding"("modelPortfolioId", "effectiveFrom");

-- AddForeignKey
ALTER TABLE "ModelPortfolioHoldingSnapshot" ADD CONSTRAINT "ModelPortfolioHoldingSnapshot_modelPortfolioId_fkey" FOREIGN KEY ("modelPortfolioId") REFERENCES "ModelPortfolio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

