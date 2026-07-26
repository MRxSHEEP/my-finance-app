-- AlterTable
ALTER TABLE "LearningProgress" ADD COLUMN     "quizScores" JSONB NOT NULL DEFAULT '[]';

-- CreateTable
CREATE TABLE "UserCertificate" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "trackId" TEXT NOT NULL,
    "scorePercent" INTEGER NOT NULL,
    "recipientName" TEXT NOT NULL,
    "awardedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "shareId" TEXT NOT NULL,

    CONSTRAINT "UserCertificate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserCertificate_shareId_key" ON "UserCertificate"("shareId");

-- CreateIndex
CREATE UNIQUE INDEX "UserCertificate_userId_trackId_key" ON "UserCertificate"("userId", "trackId");

-- AddForeignKey
ALTER TABLE "UserCertificate" ADD CONSTRAINT "UserCertificate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
