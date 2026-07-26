-- CreateTable
CREATE TABLE "BenchmarkPeerSet" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "ownCompanyTicker" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BenchmarkPeerSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BenchmarkPeer" (
    "id" TEXT NOT NULL,
    "benchmarkPeerSetId" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BenchmarkPeer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BenchmarkMetricSnapshot" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "asOfDate" TIMESTAMP(3) NOT NULL,
    "revenueGrowth" DOUBLE PRECISION,
    "grossMargin" DOUBLE PRECISION,
    "fcfYield" DOUBLE PRECISION,
    "forwardPE" DOUBLE PRECISION,
    "evEbitda" DOUBLE PRECISION,
    "roe" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BenchmarkMetricSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BenchmarkPeerSet_organizationId_key" ON "BenchmarkPeerSet"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "BenchmarkPeer_benchmarkPeerSetId_ticker_key" ON "BenchmarkPeer"("benchmarkPeerSetId", "ticker");

-- CreateIndex
CREATE INDEX "BenchmarkMetricSnapshot_organizationId_ticker_idx" ON "BenchmarkMetricSnapshot"("organizationId", "ticker");

-- CreateIndex
CREATE UNIQUE INDEX "BenchmarkMetricSnapshot_organizationId_ticker_asOfDate_key" ON "BenchmarkMetricSnapshot"("organizationId", "ticker", "asOfDate");

-- AddForeignKey
ALTER TABLE "BenchmarkPeerSet" ADD CONSTRAINT "BenchmarkPeerSet_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BenchmarkPeer" ADD CONSTRAINT "BenchmarkPeer_benchmarkPeerSetId_fkey" FOREIGN KEY ("benchmarkPeerSetId") REFERENCES "BenchmarkPeerSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BenchmarkMetricSnapshot" ADD CONSTRAINT "BenchmarkMetricSnapshot_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

