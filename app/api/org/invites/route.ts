import { NextRequest, NextResponse } from "next/server";
import { requireOrgAdmin } from "@/lib/orgAuth";
import { prisma } from "@/lib/prisma";
import { logOrgAction } from "@/lib/org/auditLog";

export const dynamic = "force-dynamic";

const INVITE_EXPIRY_DAYS = 7;

export async function GET() {
  const ctx = await requireOrgAdmin();
  if (ctx.error) return ctx.error;

  const invites = await prisma.orgInvite.findMany({
    where: { organizationId: ctx.organizationId, usedAt: null },
    include: { featureGrants: { select: { featureArea: true, role: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ invites });
}

interface GrantInput {
  featureArea: string;
  role: string;
}

// No email-sending capability exists in this app — the response's `token`
// is used by the client to build a copyable /compliance/join/[token] link
// the admin shares manually through whatever real channel they use.
export async function POST(request: NextRequest) {
  const ctx = await requireOrgAdmin();
  if (ctx.error) return ctx.error;

  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" && body.email.trim() ? body.email.trim() : null;
  const orgWideAdmin = body?.orgWideAdmin === true;
  const grants: GrantInput[] = Array.isArray(body?.grants) ? body.grants : [];

  if (!orgWideAdmin && grants.length === 0) {
    return NextResponse.json({ error: "Grant at least one feature-area role, or invite as an org-wide admin" }, { status: 400 });
  }

  const expiresAt = new Date(Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60_000);
  const invite = await prisma.orgInvite.create({
    data: {
      organizationId: ctx.organizationId,
      orgRole: orgWideAdmin ? "admin" : "member",
      email,
      createdByUserId: ctx.userId,
      expiresAt,
      featureGrants: orgWideAdmin
        ? undefined
        : { createMany: { data: grants.map((g) => ({ featureArea: g.featureArea, role: g.role })) } },
    },
    include: { featureGrants: true },
  });

  await logOrgAction({
    organizationId: ctx.organizationId,
    actorUserId: ctx.userId,
    action: "invite_created",
    targetType: "OrgInvite",
    targetId: invite.id,
    details: { email, orgWideAdmin, grants },
  });

  return NextResponse.json({ invite });
}
