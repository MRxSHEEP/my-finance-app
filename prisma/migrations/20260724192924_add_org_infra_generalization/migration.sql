-- AlterTable
ALTER TABLE "ComplianceAuditLogEntry" ADD COLUMN     "featureArea" TEXT;

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "brandColor" TEXT,
ADD COLUMN     "logoUrl" TEXT,
ADD COLUMN     "stripeCustomerId" TEXT,
ADD COLUMN     "stripeSubscriptionId" TEXT,
ADD COLUMN     "stripeSubscriptionItemId" TEXT;

-- CreateTable
CREATE TABLE "FeatureRoleGrant" (
    "id" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "featureArea" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeatureRoleGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrgInviteFeatureGrant" (
    "id" TEXT NOT NULL,
    "orgInviteId" TEXT NOT NULL,
    "featureArea" TEXT NOT NULL,
    "role" TEXT NOT NULL,

    CONSTRAINT "OrgInviteFeatureGrant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FeatureRoleGrant_membershipId_idx" ON "FeatureRoleGrant"("membershipId");

-- CreateIndex
CREATE UNIQUE INDEX "FeatureRoleGrant_membershipId_featureArea_key" ON "FeatureRoleGrant"("membershipId", "featureArea");

-- CreateIndex
CREATE UNIQUE INDEX "OrgInviteFeatureGrant_orgInviteId_featureArea_key" ON "OrgInviteFeatureGrant"("orgInviteId", "featureArea");

-- CreateIndex
CREATE INDEX "ComplianceAuditLogEntry_organizationId_featureArea_idx" ON "ComplianceAuditLogEntry"("organizationId", "featureArea");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_stripeCustomerId_key" ON "Organization"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_stripeSubscriptionId_key" ON "Organization"("stripeSubscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_stripeSubscriptionItemId_key" ON "Organization"("stripeSubscriptionItemId");

-- AddForeignKey
ALTER TABLE "FeatureRoleGrant" ADD CONSTRAINT "FeatureRoleGrant_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgInviteFeatureGrant" ADD CONSTRAINT "OrgInviteFeatureGrant_orgInviteId_fkey" FOREIGN KEY ("orgInviteId") REFERENCES "OrgInvite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

