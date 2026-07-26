import { NextRequest, NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { logComplianceAction } from "@/lib/compliance/auditLog";
import { syncStripeSeatQuantity } from "@/lib/org/billing";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const auth = await requireUserId();
  if (auth.error) return auth.error;

  const invite = await prisma.orgInvite.findUnique({
    where: { token },
    include: { organization: { select: { name: true } }, featureGrants: true },
  });
  if (!invite) return NextResponse.json({ error: "Invite not found" }, { status: 404 });

  return NextResponse.json({
    organizationName: invite.organization.name,
    orgWideAdmin: invite.orgRole === "admin",
    grants: invite.featureGrants.map((g) => ({ featureArea: g.featureArea, role: g.role })),
    expired: invite.expiresAt < new Date(),
    used: invite.usedAt !== null,
  });
}

export async function POST(_request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const auth = await requireUserId();
  if (auth.error) return auth.error;

  const invite = await prisma.orgInvite.findUnique({ where: { token }, include: { featureGrants: true } });
  if (!invite) return NextResponse.json({ error: "Invite not found" }, { status: 404 });
  if (invite.usedAt) return NextResponse.json({ error: "This invite has already been used" }, { status: 409 });
  if (invite.expiresAt < new Date()) return NextResponse.json({ error: "This invite has expired" }, { status: 409 });

  // MVP simplification: one org per user.
  const existing = await prisma.membership.findFirst({ where: { userId: auth.userId } });
  if (existing) {
    return NextResponse.json({ error: "You already belong to an organization" }, { status: 409 });
  }

  const membership = await prisma.membership.create({
    data: { userId: auth.userId, organizationId: invite.organizationId, orgRole: invite.orgRole },
  });
  if (invite.featureGrants.length > 0) {
    await prisma.featureRoleGrant.createMany({
      data: invite.featureGrants.map((g) => ({
        membershipId: membership.id,
        featureArea: g.featureArea,
        role: g.role,
      })),
    });
  }
  await prisma.orgInvite.update({
    where: { id: invite.id },
    data: { usedAt: new Date(), usedByUserId: auth.userId },
  });

  const complianceGrant = invite.featureGrants.find((g) => g.featureArea === "compliance");
  if (invite.orgRole === "admin" || complianceGrant) {
    await logComplianceAction({
      organizationId: invite.organizationId,
      actorUserId: auth.userId,
      action: "member_joined",
      targetType: "Membership",
      details: {
        role: invite.orgRole === "admin" ? "admin" : complianceGrant?.role,
        viaInviteId: invite.id,
      },
    });
  }
  await syncStripeSeatQuantity(invite.organizationId);

  return NextResponse.json({
    ok: true,
    organizationId: invite.organizationId,
    orgWideAdmin: invite.orgRole === "admin",
    grants: invite.featureGrants.map((g) => ({ featureArea: g.featureArea, role: g.role })),
  });
}
