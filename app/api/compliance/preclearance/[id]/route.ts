import { NextRequest, NextResponse } from "next/server";
import { requireOrgRole } from "@/lib/complianceAuth";
import { prisma } from "@/lib/prisma";
import { logComplianceAction } from "@/lib/compliance/auditLog";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireOrgRole("compliance_officer");
  if (ctx.error) return ctx.error;

  const body = await request.json().catch(() => null);
  const decision = body?.decision;
  const decisionNotes = typeof body?.decisionNotes === "string" ? body.decisionNotes.trim() : null;

  if (decision !== "approved" && decision !== "denied") {
    return NextResponse.json({ error: "decision must be \"approved\" or \"denied\"" }, { status: 400 });
  }

  const result = await prisma.preclearanceRequest.updateMany({
    where: { id, organizationId: ctx.organizationId, status: "pending" },
    data: { status: decision, decidedByUserId: ctx.userId, decidedAt: new Date(), decisionNotes },
  });
  if (result.count === 0) {
    return NextResponse.json({ error: "Pending pre-clearance request not found" }, { status: 404 });
  }

  const updated = await prisma.preclearanceRequest.findUnique({ where: { id } });

  await logComplianceAction({
    organizationId: ctx.organizationId,
    actorUserId: ctx.userId,
    action: decision === "approved" ? "preclearance_approved" : "preclearance_denied",
    targetType: "PreclearanceRequest",
    targetId: id,
    ticker: updated?.ticker,
    details: { decisionNotes },
  });

  return NextResponse.json({ request: updated });
}
