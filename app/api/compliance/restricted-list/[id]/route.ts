import { NextRequest, NextResponse } from "next/server";
import { requireOrgRole } from "@/lib/complianceAuth";
import { prisma } from "@/lib/prisma";
import { logComplianceAction } from "@/lib/compliance/auditLog";

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireOrgRole("compliance_officer");
  if (ctx.error) return ctx.error;

  const entry = await prisma.restrictedListEntry.findFirst({
    where: { id, organizationId: ctx.organizationId, removedAt: null },
  });
  if (!entry) return NextResponse.json({ error: "Restricted list entry not found" }, { status: 404 });

  await prisma.restrictedListEntry.update({
    where: { id },
    data: { removedAt: new Date(), removedByUserId: ctx.userId },
  });

  await logComplianceAction({
    organizationId: ctx.organizationId,
    actorUserId: ctx.userId,
    action: "restricted_list_remove",
    targetType: "RestrictedListEntry",
    targetId: id,
    ticker: entry.ticker,
  });

  return NextResponse.json({ ok: true });
}
