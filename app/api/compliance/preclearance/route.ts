import { NextRequest, NextResponse } from "next/server";
import { requireOrgMembership } from "@/lib/complianceAuth";
import { prisma } from "@/lib/prisma";
import { logComplianceAction } from "@/lib/compliance/auditLog";
import { evaluateTradeForFlags } from "@/lib/compliance/flagging";
import { hasAtLeastRole } from "@/lib/compliance/roles";
import { validateRealTicker } from "@/lib/resolveTicker";

export const dynamic = "force-dynamic";

const VALID_TRANSACTION_TYPES = ["buy", "sell"];
const VALID_STATUSES = ["pending", "approved", "denied"];

export async function GET(request: NextRequest) {
  const ctx = await requireOrgMembership();
  if (ctx.error) return ctx.error;

  const isReviewer = hasAtLeastRole(ctx.role, "compliance_officer");
  const statusParam = request.nextUrl.searchParams.get("status");
  const status = statusParam && VALID_STATUSES.includes(statusParam) ? statusParam : undefined;

  const requests = await prisma.preclearanceRequest.findMany({
    where: {
      organizationId: ctx.organizationId,
      userId: isReviewer ? undefined : ctx.userId,
      status,
    },
    include: isReviewer ? { user: { select: { id: true, name: true, email: true } } } : undefined,
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ requests });
}

export async function POST(request: NextRequest) {
  const ctx = await requireOrgMembership();
  if (ctx.error) return ctx.error;

  const body = await request.json().catch(() => null);
  const ticker = typeof body?.ticker === "string" ? body.ticker.trim().toUpperCase() : "";
  const transactionType = body?.transactionType;
  const quantity = Number(body?.quantity);
  const proposedTradeDateRaw = typeof body?.proposedTradeDate === "string" ? body.proposedTradeDate : "";
  const notes = typeof body?.notes === "string" ? body.notes.trim() : null;

  if (!ticker) return NextResponse.json({ error: "Ticker is required" }, { status: 400 });
  if (!VALID_TRANSACTION_TYPES.includes(transactionType)) {
    return NextResponse.json({ error: "transactionType must be \"buy\" or \"sell\"" }, { status: 400 });
  }
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return NextResponse.json({ error: "Quantity must be a positive number" }, { status: 400 });
  }
  const proposedTradeDate = new Date(proposedTradeDateRaw);
  if (Number.isNaN(proposedTradeDate.getTime())) {
    return NextResponse.json({ error: "Invalid proposedTradeDate" }, { status: 400 });
  }

  // Server-side enforcement — the restricted-list check below matches on
  // this exact string, so an unresolved free-text ticker (e.g. "GOOGLE"
  // instead of "GOOGL") would silently produce zero flags even against a
  // genuinely restricted company. TickerAutocompleteInput's dropdown is a
  // convenience, not a guarantee, so this is validated here regardless of
  // whether a suggestion was ever selected client-side.
  const tickerCheck = await validateRealTicker(ticker);
  if (!tickerCheck.valid) {
    return NextResponse.json({ error: tickerCheck.error }, { status: 400 });
  }

  const preclearanceRequest = await prisma.preclearanceRequest.create({
    data: {
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      ticker,
      proposedTradeDate,
      transactionType,
      quantity,
      notes,
    },
  });

  await logComplianceAction({
    organizationId: ctx.organizationId,
    actorUserId: ctx.userId,
    action: "preclearance_requested",
    targetType: "PreclearanceRequest",
    targetId: preclearanceRequest.id,
    ticker,
    details: { transactionType, quantity },
  });

  // Flagged proactively (not just on the eventual disclosure) so a
  // Compliance Officer reviewing a pending request already sees whether
  // it conflicts with the restricted list or insider activity nearby.
  const flags = await evaluateTradeForFlags({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    ticker,
    tradeDate: proposedTradeDate,
    sourceType: "preclearance_request",
    sourceId: preclearanceRequest.id,
  });

  return NextResponse.json({ request: preclearanceRequest, flags });
}
