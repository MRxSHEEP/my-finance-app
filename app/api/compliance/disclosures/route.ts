import { NextRequest, NextResponse } from "next/server";
import { requireOrgMembership } from "@/lib/complianceAuth";
import { prisma } from "@/lib/prisma";
import { logComplianceAction } from "@/lib/compliance/auditLog";
import { evaluateTradeForFlags } from "@/lib/compliance/flagging";
import { hasAtLeastRole } from "@/lib/compliance/roles";

export const dynamic = "force-dynamic";

const VALID_TRANSACTION_TYPES = ["buy", "sell"];

export async function GET(request: NextRequest) {
  const ctx = await requireOrgMembership();
  if (ctx.error) return ctx.error;

  const isReviewer = hasAtLeastRole(ctx.role, "compliance_officer");
  const requestedUserId = request.nextUrl.searchParams.get("userId");

  const disclosures = await prisma.tradeDisclosure.findMany({
    where: {
      organizationId: ctx.organizationId,
      // Employees only ever see their own rows, regardless of ?userId=.
      userId: isReviewer ? (requestedUserId ?? undefined) : ctx.userId,
    },
    include: isReviewer ? { user: { select: { id: true, name: true, email: true } } } : undefined,
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ disclosures });
}

export async function POST(request: NextRequest) {
  const ctx = await requireOrgMembership();
  if (ctx.error) return ctx.error;

  const body = await request.json().catch(() => null);
  const ticker = typeof body?.ticker === "string" ? body.ticker.trim().toUpperCase() : "";
  const transactionType = body?.transactionType;
  const quantity = Number(body?.quantity);
  const tradeDateRaw = typeof body?.tradeDate === "string" ? body.tradeDate : "";
  const notes = typeof body?.notes === "string" ? body.notes.trim() : null;

  if (!ticker) return NextResponse.json({ error: "Ticker is required" }, { status: 400 });
  if (!VALID_TRANSACTION_TYPES.includes(transactionType)) {
    return NextResponse.json({ error: "transactionType must be \"buy\" or \"sell\"" }, { status: 400 });
  }
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return NextResponse.json({ error: "Quantity must be a positive number" }, { status: 400 });
  }
  const tradeDate = new Date(tradeDateRaw);
  if (Number.isNaN(tradeDate.getTime())) {
    return NextResponse.json({ error: "Invalid tradeDate" }, { status: 400 });
  }

  const disclosure = await prisma.tradeDisclosure.create({
    data: {
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      ticker,
      tradeDate,
      transactionType,
      quantity,
      notes,
    },
  });

  await logComplianceAction({
    organizationId: ctx.organizationId,
    actorUserId: ctx.userId,
    action: "trade_disclosed",
    targetType: "TradeDisclosure",
    targetId: disclosure.id,
    ticker,
    details: { transactionType, quantity },
  });

  const flags = await evaluateTradeForFlags({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    ticker,
    tradeDate,
    sourceType: "trade_disclosure",
    sourceId: disclosure.id,
  });

  return NextResponse.json({ disclosure, flags });
}
