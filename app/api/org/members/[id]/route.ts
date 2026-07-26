import { NextRequest, NextResponse } from "next/server";
import { requireOrgAdmin } from "@/lib/orgAuth";
import { prisma } from "@/lib/prisma";
import { logOrgAction } from "@/lib/org/auditLog";
import { syncStripeSeatQuantity } from "@/lib/org/billing";

// Without this, an org could accidentally end up with zero admins and no
// path back in — there's no SSO/support tooling to recover access.
// `newOrgRole` is the role the target membership would have *after* this
// change (null for a removal, which can never itself be "admin").
async function wouldLeaveNoAdmins(
  organizationId: string,
  membershipId: string,
  newOrgRole: "member" | "admin" | null
): Promise<boolean> {
  const admins = await prisma.membership.findMany({
    where: { organizationId, orgRole: "admin" },
    select: { id: true },
  });
  const remaining = admins.filter((a) => a.id !== membershipId || newOrgRole === "admin");
  return remaining.length === 0;
}

interface GrantInput {
  featureArea: string;
  role: string;
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireOrgAdmin();
  if (ctx.error) return ctx.error;

  const body = await request.json().catch(() => null);
  const orgRole = body?.orgRole;
  const grants: GrantInput[] | undefined = Array.isArray(body?.grants) ? body.grants : undefined;

  if (orgRole !== undefined && orgRole !== "member" && orgRole !== "admin") {
    return NextResponse.json({ error: "orgRole must be \"member\" or \"admin\"" }, { status: 400 });
  }

  const membership = await prisma.membership.findFirst({ where: { id, organizationId: ctx.organizationId } });
  if (!membership) return NextResponse.json({ error: "Member not found" }, { status: 404 });

  const nextOrgRole = orgRole ?? membership.orgRole;
  if (membership.orgRole === "admin" && (await wouldLeaveNoAdmins(ctx.organizationId, id, nextOrgRole))) {
    return NextResponse.json({ error: "This would leave the organization with no admins" }, { status: 400 });
  }

  await prisma.$transaction(async (tx) => {
    if (orgRole !== undefined) {
      await tx.membership.update({ where: { id }, data: { orgRole } });
    }
    // Admin bypasses every feature area, so it never needs its own grant
    // rows — clear them when promoting to admin, for a clean UI rather
    // than confusing, unused leftover grants.
    if (nextOrgRole === "admin") {
      await tx.featureRoleGrant.deleteMany({ where: { membershipId: id } });
    } else if (grants) {
      await tx.featureRoleGrant.deleteMany({ where: { membershipId: id } });
      if (grants.length > 0) {
        await tx.featureRoleGrant.createMany({
          data: grants.map((g) => ({ membershipId: id, featureArea: g.featureArea, role: g.role })),
        });
      }
    }
  });

  await logOrgAction({
    organizationId: ctx.organizationId,
    actorUserId: ctx.userId,
    action: "member_role_changed",
    targetType: "Membership",
    targetId: id,
    details: { userId: membership.userId, previousOrgRole: membership.orgRole, nextOrgRole, grants },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireOrgAdmin();
  if (ctx.error) return ctx.error;

  const membership = await prisma.membership.findFirst({ where: { id, organizationId: ctx.organizationId } });
  if (!membership) return NextResponse.json({ error: "Member not found" }, { status: 404 });

  if (membership.orgRole === "admin" && (await wouldLeaveNoAdmins(ctx.organizationId, id, null))) {
    return NextResponse.json({ error: "This would leave the organization with no admins" }, { status: 400 });
  }

  await prisma.membership.delete({ where: { id } });
  await logOrgAction({
    organizationId: ctx.organizationId,
    actorUserId: ctx.userId,
    action: "member_removed",
    targetType: "Membership",
    targetId: id,
    details: { userId: membership.userId, orgRole: membership.orgRole },
  });
  await syncStripeSeatQuantity(ctx.organizationId);

  return NextResponse.json({ ok: true });
}
