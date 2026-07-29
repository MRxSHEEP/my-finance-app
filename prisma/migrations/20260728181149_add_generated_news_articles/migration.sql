-- CreateTable
CREATE TABLE "GeneratedNewsArticle" (
    "id" TEXT NOT NULL,
    "assetType" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "dataSnapshot" JSONB NOT NULL,
    "citedFacts" JSONB NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GeneratedNewsArticle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GeneratedNewsArticle_generatedAt_idx" ON "GeneratedNewsArticle"("generatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "GeneratedNewsArticle_assetType_ticker_key" ON "GeneratedNewsArticle"("assetType", "ticker");

