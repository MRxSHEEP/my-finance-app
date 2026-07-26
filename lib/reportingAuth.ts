import { NextResponse } from "next/server";
import { requireFeatureRole } from "@/lib/orgAuth";
import { hasAtLeastRole, type ReportingRole } from "@/lib/reporting/roles";

export type OrgAuthResult =
  | { userId: string; organizationId: string; role: ReportingRole; error?: undefined }
  | { userId?: undefined; organizationId?: undefined; role?: undefined; error: NextResponse };

// Thin wrapper over lib/orgAuth.ts's generic resolver, byte-for-byte mirror
// of lib/complianceAuth.ts's shape — "reporting" is just another feature
// area, with org-wide Admin bypassing its role check same as every other
// area. NOTE: since ReportingRole has only one tier ("advisor"), an Admin
// bypass is indistinguishable here from a real grant — routes that need to
// tell those apart (report-list scoping, single-report ownership) call
// lib/orgAuth.ts's requireOrgMembership() directly instead. See the
// White-Label Branded Reporting plan's "architectural nuance" section.
const FEATURE_AREA = "reporting";

export async function requireOrgMembership(): Promise<OrgAuthResult> {
  return requireFeatureRole(FEATURE_AREA, "advisor", hasAtLeastRole, "advisor");
}

export async function requireOrgRole(minRole: ReportingRole): Promise<OrgAuthResult> {
  return requireFeatureRole(FEATURE_AREA, minRole, hasAtLeastRole, "advisor");
}
