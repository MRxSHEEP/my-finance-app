import { NextRequest, NextResponse } from "next/server";
import { requireOrgAdmin } from "@/lib/orgAuth";
import { prisma } from "@/lib/prisma";
import { logOrgAction } from "@/lib/org/auditLog";

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireOrgAdmin();
  if (ctx.error) return ctx.error;

  const result = await prisma.orgInvite.deleteMany({
    where: { id, organizationId: ctx.organizationId, usedAt: null },
  });
  if (result.count === 0) return NextResponse.json({ error: "Invite not found" }, { status: 404 });

  await logOrgAction({
    organizationId: ctx.organizationId,
    actorUserId: ctx.userId,
    action: "invite_revoked",
    targetType: "OrgInvite",
    targetId: id,
  });

  return NextResponse.json({ ok: true });
}
