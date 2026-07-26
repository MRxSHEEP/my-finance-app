import { NextRequest, NextResponse } from "next/server";
import { requireOrgMembership, requireOrgRole } from "@/lib/complianceAuth";
import { prisma } from "@/lib/prisma";
import { logComplianceAction } from "@/lib/compliance/auditLog";
import { hasAtLeastRole } from "@/lib/compliance/roles";

export const dynamic = "force-dynamic";

// Employees can see the current restricted list read-only (so they can
// self-check before disclosing/requesting a trade), but not who
// added/removed an entry or the removal history — that stays
// Compliance-Officer/Admin-only.
export async function GET() {
  const ctx = await requireOrgMembership();
  if (ctx.error) return ctx.error;

  const canSeeHistory = hasAtLeastRole(ctx.role, "compliance_officer");

  const entries = await prisma.restrictedListEntry.findMany({
    where: canSeeHistory ? { organizationId: ctx.organizationId } : { organizationId: ctx.organizationId, removedAt: null },
    orderBy: { addedAt: "desc" },
  });

  if (!canSeeHistory) {
    return NextResponse.json({
      entries: entries.map((e) => ({ id: e.id, ticker: e.ticker, companyName: e.companyName })),
    });
  }

  return NextResponse.json({ entries });
}

export async function POST(request: NextRequest) {
  const ctx = await requireOrgRole("compliance_officer");
  if (ctx.error) return ctx.error;

  const body = await request.json().catch(() => null);
  const ticker = typeof body?.ticker === "string" ? body.ticker.trim().toUpperCase() : "";
  const companyName = typeof body?.companyName === "string" ? body.companyName.trim() : null;
  const notes = typeof body?.notes === "string" ? body.notes.trim() : null;

  if (!ticker) return NextResponse.json({ error: "Ticker is required" }, { status: 400 });

  const existing = await prisma.restrictedListEntry.findFirst({
    where: { organizationId: ctx.organizationId, ticker, removedAt: null },
  });
  if (existing) {
    return NextResponse.json({ error: `${ticker} is already on the restricted list` }, { status: 409 });
  }

  const entry = await prisma.restrictedListEntry.create({
    data: { organizationId: ctx.organizationId, ticker, companyName, notes, addedByUserId: ctx.userId },
  });

  await logComplianceAction({
    organizationId: ctx.organizationId,
    actorUserId: ctx.userId,
    action: "restricted_list_add",
    targetType: "RestrictedListEntry",
    targetId: entry.id,
    ticker,
    details: { companyName, notes },
  });

  return NextResponse.json({ entry });
}
