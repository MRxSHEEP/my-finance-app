-- CreateTable
CREATE TABLE "TrackedEntity" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT,
    "photoUrl" TEXT,
    "secCik" TEXT,
    "congressOffice" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrackedEntity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrackerTransaction" (
    "id" TEXT NOT NULL,
    "trackedEntityId" TEXT NOT NULL,
    "ticker" TEXT,
    "issuerName" TEXT,
    "transactionType" TEXT NOT NULL,
    "reportedDate" TIMESTAMP(3),
    "tradeDate" TIMESTAMP(3),
    "disclosureDate" TIMESTAMP(3),
    "amountLow" DOUBLE PRECISION,
    "amountHigh" DOUBLE PRECISION,
    "exactValue" DOUBLE PRECISION,
    "shares" DOUBLE PRECISION,
    "pricePerShare" DOUBLE PRECISION,
    "isEstimate" BOOLEAN NOT NULL DEFAULT false,
    "sourceType" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "dedupeKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrackerTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrackerHolding" (
    "id" TEXT NOT NULL,
    "trackedEntityId" TEXT NOT NULL,
    "ticker" TEXT,
    "issuerName" TEXT,
    "shares" DOUBLE PRECISION,
    "estimatedValue" DOUBLE PRECISION,
    "asOfDate" TIMESTAMP(3) NOT NULL,
    "isEstimate" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrackerHolding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrackerFollow" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "trackedEntityId" TEXT NOT NULL,
    "snapshotAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "snapshotHoldings" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrackerFollow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrackerNotification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "trackedEntityId" TEXT NOT NULL,
    "transactionId" TEXT,
    "message" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrackerNotification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TrackedEntity_slug_key" ON "TrackedEntity"("slug");

-- CreateIndex
CREATE INDEX "TrackedEntity_type_idx" ON "TrackedEntity"("type");

-- CreateIndex
CREATE UNIQUE INDEX "TrackerTransaction_dedupeKey_key" ON "TrackerTransaction"("dedupeKey");

-- CreateIndex
CREATE INDEX "TrackerTransaction_ticker_idx" ON "TrackerTransaction"("ticker");

-- CreateIndex
CREATE INDEX "TrackerTransaction_trackedEntityId_idx" ON "TrackerTransaction"("trackedEntityId");

-- CreateIndex
CREATE UNIQUE INDEX "TrackerHolding_trackedEntityId_ticker_key" ON "TrackerHolding"("trackedEntityId", "ticker");

-- CreateIndex
CREATE UNIQUE INDEX "TrackerFollow_userId_trackedEntityId_key" ON "TrackerFollow"("userId", "trackedEntityId");

-- CreateIndex
CREATE INDEX "TrackerNotification_userId_idx" ON "TrackerNotification"("userId");

-- AddForeignKey
ALTER TABLE "TrackerTransaction" ADD CONSTRAINT "TrackerTransaction_trackedEntityId_fkey" FOREIGN KEY ("trackedEntityId") REFERENCES "TrackedEntity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackerHolding" ADD CONSTRAINT "TrackerHolding_trackedEntityId_fkey" FOREIGN KEY ("trackedEntityId") REFERENCES "TrackedEntity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackerFollow" ADD CONSTRAINT "TrackerFollow_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackerFollow" ADD CONSTRAINT "TrackerFollow_trackedEntityId_fkey" FOREIGN KEY ("trackedEntityId") REFERENCES "TrackedEntity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackerNotification" ADD CONSTRAINT "TrackerNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
