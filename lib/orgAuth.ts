import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

export interface OrgMembershipContext {
  userId: string;
  organizationId: string;
  // Org-wide tier — "admin" bypasses every per-feature grant below with
  // full access everywhere; "member" needs an explicit grant per feature.
  orgRole: "member" | "admin";
  // featureArea -> role. An absent key means no grant for that feature.
  featureGrants: Record<string, string>;
}

export type OrgAuthResult =
  | (OrgMembershipContext & { error?: undefined })
  | { userId?: undefined; organizationId?: undefined; orgRole?: undefined; featureGrants?: undefined; error: NextResponse };

// MVP simplification carried over from Compliance: one org per user —
// findFirst, not findMany (no org-switcher UI exists).
export async function requireOrgMembership(): Promise<OrgAuthResult> {
  const auth = await requireUserId();
  if (auth.error) return { error: auth.error };

  const membership = await prisma.membership.findFirst({
    where: { userId: auth.userId },
    include: { featureRoleGrants: true },
  });
  if (!membership) {
    return { error: NextResponse.json({ error: "Not part of an organization" }, { status: 403 }) };
  }

  return {
    userId: auth.userId,
    organizationId: membership.organizationId,
    orgRole: membership.orgRole as "member" | "admin",
    featureGrants: Object.fromEntries(membership.featureRoleGrants.map((g) => [g.featureArea, g.role])),
  };
}

// Gates the shared settings page and its API routes — org-wide Admin only.
export async function requireOrgAdmin(): Promise<OrgAuthResult> {
  const ctx = await requireOrgMembership();
  if (ctx.error) return ctx;
  if (ctx.orgRole !== "admin") {
    return { error: NextResponse.json({ error: "Admin access required" }, { status: 403 }) };
  }
  return ctx;
}

// The generic entry point every feature area builds its own auth helper on
// top of (see lib/complianceAuth.ts). Each feature owns its own role
// vocabulary and rank comparator — this function never encodes per-feature
// rank semantics, only "does a grant exist and does it clear the caller's
// own bar." `bypassRole` is what an org-wide Admin resolves to, so callers
// keep comparing against their own typed role rather than special-casing
// an "admin bypass" branch everywhere.
export async function requireFeatureRole<R extends string>(
  featureArea: string,
  minRole: R,
  hasAtLeast: (role: R, min: R) => boolean,
  bypassRole: R
): Promise<{ userId: string; organizationId: string; role: R; error?: undefined } | { error: NextResponse }> {
  const ctx = await requireOrgMembership();
  if (ctx.error) return ctx;

  const role = (ctx.orgRole === "admin" ? bypassRole : ctx.featureGrants[featureArea]) as R | undefined;
  if (role === undefined) {
    return { error: NextResponse.json({ error: "Not part of an organization" }, { status: 403 }) };
  }
  if (!hasAtLeast(role, minRole)) {
    return { error: NextResponse.json({ error: "Insufficient permissions" }, { status: 403 }) };
  }
  return { userId: ctx.userId, organizationId: ctx.organizationId, role };
}
