import { NextResponse } from "next/server";
import { requireFeatureRole } from "@/lib/orgAuth";
import { hasAtLeastRole, type ComplianceRole } from "@/lib/compliance/roles";

export type OrgAuthResult =
  | { userId: string; organizationId: string; role: ComplianceRole; error?: undefined }
  | { userId?: undefined; organizationId?: undefined; role?: undefined; error: NextResponse };

// Thin wrapper over the generic lib/orgAuth.ts resolver — Compliance is
// just the "compliance" feature area now, with org-wide Admin membership
// bypassing its role check same as every other feature area. Exact same
// exported signatures/shape as before this generalization, so every one of
// Compliance's own route files needs zero changes.
const FEATURE_AREA = "compliance";

export async function requireOrgMembership(): Promise<OrgAuthResult> {
  return requireFeatureRole(FEATURE_AREA, "employee", hasAtLeastRole, "admin");
}

export async function requireOrgRole(minRole: ComplianceRole): Promise<OrgAuthResult> {
  return requireFeatureRole(FEATURE_AREA, minRole, hasAtLeastRole, "admin");
}
