-- Backfills the new per-feature-area grant model from Membership/OrgInvite's
-- previously-flat "role" column, which is now Membership.orgRole/
-- OrgInvite.orgRole (Prisma-side rename only, physical column is still
-- named "role" via @map — see prisma/schema.prisma). Compliance was the
-- only feature area before this migration, so every pre-existing non-admin
-- row IS a Compliance membership/invite; its exact original role string is
-- preserved verbatim in the new grant tables rather than lost.
--
-- Runs as one transaction (Prisma wraps each migration.sql file in a
-- transaction by default for Postgres), so a partial failure fully rolls
-- back rather than leaving Membership/OrgInvite narrowed without their
-- corresponding grant rows.

-- Every non-admin Membership becomes a "compliance" grant preserving its
-- exact original role string ("employee" | "compliance_officer").
INSERT INTO "FeatureRoleGrant" ("id", "membershipId", "featureArea", "role", "createdAt")
SELECT "id" || '_compliance', "id", 'compliance', "role", CURRENT_TIMESTAMP
FROM "Membership"
WHERE "role" <> 'admin'
ON CONFLICT ("membershipId", "featureArea") DO NOTHING;

-- Same backfill for invites (pending and already-used alike, for a total
-- rather than conditional backfill).
INSERT INTO "OrgInviteFeatureGrant" ("id", "orgInviteId", "featureArea", "role")
SELECT "id" || '_compliance', "id", 'compliance', "role"
FROM "OrgInvite"
WHERE "role" <> 'admin'
ON CONFLICT ("orgInviteId", "featureArea") DO NOTHING;

-- Narrow every non-admin row's org-wide tier to "member" — its original
-- string now lives safely in the grant tables above. Admin rows are
-- untouched (org-wide Admin already bypasses every feature-area check, so
-- it never needs a grant row of its own).
UPDATE "Membership" SET "role" = 'member' WHERE "role" <> 'admin';
UPDATE "OrgInvite" SET "role" = 'member' WHERE "role" <> 'admin';

-- Tag every pre-existing audit-log row as Compliance's, since Compliance
-- was the only writer of this table before the generic service existed.
UPDATE "ComplianceAuditLogEntry" SET "featureArea" = 'compliance' WHERE "featureArea" IS NULL;
