-- CreateTable
CREATE TABLE "TrackerPerformanceSnapshot" (
    "id" TEXT NOT NULL,
    "trackedEntityId" TEXT NOT NULL,
    "asOfDate" TIMESTAMP(3) NOT NULL,
    "totalValue" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrackerPerformanceSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TrackerPerformanceSnapshot_trackedEntityId_asOfDate_key" ON "TrackerPerformanceSnapshot"("trackedEntityId", "asOfDate");

-- AddForeignKey
ALTER TABLE "TrackerPerformanceSnapshot" ADD CONSTRAINT "TrackerPerformanceSnapshot_trackedEntityId_fkey" FOREIGN KEY ("trackedEntityId") REFERENCES "TrackedEntity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
