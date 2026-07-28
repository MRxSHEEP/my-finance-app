import { NextRequest, NextResponse } from "next/server";
import { requireOrgRole } from "@/lib/complianceAuth";
import { logComplianceAction } from "@/lib/compliance/auditLog";
import { gatherPreclearanceContext } from "@/lib/complianceCopilot/gather";
import { generateComplianceReview } from "@/lib/complianceCopilot/generate";

export const dynamic = "force-dynamic";

// Read-only and non-persisting: this never creates a ComplianceFlag,
// never sets decisionNotes, and never changes the request's status. It's
// a fresh, on-demand draft (see components/compliance/PreclearanceTable.tsx)
// for the officer's own Approve/Deny action (PATCH .../[id]) to use, edit,
// or ignore entirely — the only audit trail this route itself writes is
// that the assist was requested, not any decision.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireOrgRole("compliance_officer");
  if (ctx.error) return ctx.error;

  const context = await gatherPreclearanceContext(id, ctx.organizationId);
  if (!context) {
    return NextResponse.json({ error: "Pre-clearance request not found" }, { status: 404 });
  }

  const review = await generateComplianceReview(context);
  if (!review) {
    return NextResponse.json({ error: "AI review is unavailable right now" }, { status: 503 });
  }

  await logComplianceAction({
    organizationId: ctx.organizationId,
    actorUserId: ctx.userId,
    action: "ai_review_requested",
    targetType: "PreclearanceRequest",
    targetId: id,
    ticker: context.request.ticker,
    details: { flag: review.flag },
  });

  return NextResponse.json(review);
}
