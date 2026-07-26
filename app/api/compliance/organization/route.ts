import { NextRequest, NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { logComplianceAction } from "@/lib/compliance/auditLog";
import { syncStripeSeatQuantity } from "@/lib/org/billing";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireUserId();
  if (auth.error) return auth.error;

  const membership = await prisma.membership.findFirst({
    where: { userId: auth.userId },
    include: { organization: true, featureRoleGrants: true },
  });

  if (!membership) return NextResponse.json({ organization: null });

  // Org-wide Admin bypasses every feature area; otherwise resolve this
  // user's Compliance-specific grant — same resolution lib/complianceAuth.ts
  // does internally, kept in sync here since this route needs the role
  // alongside the organization's own fields in one response.
  const role =
    membership.orgRole === "admin"
      ? "admin"
      : membership.featureRoleGrants.find((g) => g.featureArea === "compliance")?.role ?? null;

  return NextResponse.json({
    organization: { id: membership.organization.id, name: membership.organization.name },
    role,
  });
}

// MVP simplification: one org per user — creating a second org while
// already a member is rejected rather than supported, matching the
// single-org assumption every other compliance route makes.
export async function POST(request: NextRequest) {
  const auth = await requireUserId();
  if (auth.error) return auth.error;

  const existing = await prisma.membership.findFirst({ where: { userId: auth.userId } });
  if (existing) {
    return NextResponse.json({ error: "You already belong to an organization" }, { status: 409 });
  }

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "Organization name is required" }, { status: 400 });
  }

  const organization = await prisma.organization.create({ data: { name } });
  await prisma.membership.create({
    data: { userId: auth.userId, organizationId: organization.id, orgRole: "admin" },
  });
  await logComplianceAction({
    organizationId: organization.id,
    actorUserId: auth.userId,
    action: "member_joined",
    targetType: "Membership",
    details: { role: "admin", reason: "organization_created" },
  });
  await syncStripeSeatQuantity(organization.id);

  return NextResponse.json({ organization: { id: organization.id, name: organization.name }, role: "admin" });
}
