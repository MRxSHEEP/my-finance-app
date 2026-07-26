import { NextRequest, NextResponse } from "next/server";
import { requireOrgRole } from "@/lib/complianceAuth";
import { prisma } from "@/lib/prisma";
import { logComplianceAction } from "@/lib/compliance/auditLog";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireOrgRole("compliance_officer");
  if (ctx.error) return ctx.error;

  const body = await request.json().catch(() => null);
  const reviewNotes = typeof body?.reviewNotes === "string" ? body.reviewNotes.trim() : null;

  const result = await prisma.complianceFlag.updateMany({
    where: { id, organizationId: ctx.organizationId, status: "open" },
    data: { status: "reviewed", reviewedByUserId: ctx.userId, reviewedAt: new Date(), reviewNotes },
  });
  if (result.count === 0) return NextResponse.json({ error: "Open flag not found" }, { status: 404 });

  const flag = await prisma.complianceFlag.findUnique({ where: { id } });

  await logComplianceAction({
    organizationId: ctx.organizationId,
    actorUserId: ctx.userId,
    action: "flag_reviewed",
    targetType: "ComplianceFlag",
    targetId: id,
    ticker: flag?.ticker,
    details: { reviewNotes },
  });

  return NextResponse.json({ flag });
}
