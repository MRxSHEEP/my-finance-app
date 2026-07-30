import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrgMembership } from "@/lib/orgAuth";
import { requireOrgRole } from "@/lib/reportingAuth";
import { getCurrentPrice, type AssetType } from "@/lib/simulatedTrading/pricing";
import { WEIGHT_SUM_EPSILON, NOTIONAL_BASE, todayAtMidnightUtc } from "@/lib/modelPortfolios/constants";

export const dynamic = "force-dynamic";

const ASSET_TYPES = ["stock", "commodity", "crypto"];

interface HoldingInput {
  assetType: string;
  symbol: string;
  name?: string;
  targetWeightPercent: number;
}

function validateHoldings(holdings: unknown): { error: string } | { holdings: HoldingInput[] } {
  if (!Array.isArray(holdings) || holdings.length === 0) {
    return { error: "At least one holding is required" };
  }
  const parsed: HoldingInput[] = [];
  for (const h of holdings) {
    if (!ASSET_TYPES.includes(h?.assetType)) return { error: "Invalid assetType" };
    if (typeof h?.symbol !== "string" || !h.symbol.trim()) return { error: "Invalid symbol" };
    if (typeof h?.targetWeightPercent !== "number" || !Number.isFinite(h.targetWeightPercent) || h.targetWeightPercent <= 0) {
      return { error: "Each holding's targetWeightPercent must be a positive number" };
    }
    parsed.push({
      assetType: h.assetType,
      symbol: h.symbol.trim().toUpperCase(),
      name: typeof h.name === "string" && h.name.trim() ? h.name.trim() : undefined,
      targetWeightPercent: h.targetWeightPercent,
    });
  }
  const weightSum = parsed.reduce((sum, h) => sum + h.targetWeightPercent, 0);
  if (Math.abs(weightSum - 100) > WEIGHT_SUM_EPSILON) {
    return { error: `Target weights must sum to 100% (got ${weightSum.toFixed(2)}%)` };
  }
  return { holdings: parsed };
}

// Gated via lib/orgAuth.ts's requireOrgMembership() DIRECTLY (not
// lib/reportingAuth.ts) so this can branch on the real orgRole — same
// nuance as app/api/reporting/reports/route.ts's own GET: a plain advisor
// sees only their own model portfolios, an org-wide Admin sees every
// portfolio in the org (+ creator names).
export async function GET() {
  const ctx = await requireOrgMembership();
  if (ctx.error) return ctx.error;

  const isAdmin = ctx.orgRole === "admin";
  const hasReportingAccess = isAdmin || ctx.featureGrants["reporting"] !== undefined;
  if (!hasReportingAccess) {
    return NextResponse.json({ error: "Not part of Reporting" }, { status: 403 });
  }

  const portfolios = await prisma.modelPortfolio.findMany({
    where: {
      organizationId: ctx.organizationId,
      createdByUserId: isAdmin ? undefined : ctx.userId,
    },
    include: { _count: { select: { holdings: true } }, shareLink: { select: { active: true } } },
    orderBy: { createdAt: "desc" },
  });

  let creatorNames: Record<string, string> = {};
  if (isAdmin && portfolios.length > 0) {
    const creators = await prisma.user.findMany({
      where: { id: { in: [...new Set(portfolios.map((p) => p.createdByUserId))] } },
      select: { id: true, name: true, email: true },
    });
    creatorNames = Object.fromEntries(creators.map((u) => [u.id, u.name ?? u.email]));
  }

  return NextResponse.json({
    portfolios: portfolios.map((p) => ({
      id: p.id,
      name: p.name,
      holdingsCount: p._count.holdings,
      shareLinkActive: p.shareLink?.active ?? false,
      createdAt: p.createdAt.toISOString(),
      createdByUserId: p.createdByUserId,
      creatorName: isAdmin ? (creatorNames[p.createdByUserId] ?? null) : null,
    })),
  });
}

export async function POST(request: NextRequest) {
  const ctx = await requireOrgRole("advisor");
  if (ctx.error) return ctx.error;

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

  const validated = validateHoldings(body?.holdings);
  if ("error" in validated) return NextResponse.json({ error: validated.error }, { status: 400 });

  const priceResults = await Promise.all(
    validated.holdings.map((h) => getCurrentPrice(h.assetType as AssetType, h.symbol))
  );
  const missingIndex = priceResults.findIndex((r) => !r);
  if (missingIndex !== -1) {
    return NextResponse.json(
      { error: `Price unavailable for ${validated.holdings[missingIndex].symbol} — try again` },
      { status: 400 }
    );
  }

  // createdAt keeps full precision (the exact moment the record was made),
  // but effectiveFrom is day-granular (midnight UTC) — matching, not full
  // timestamp precision, since that's the same granularity every other
  // effectiveFrom/effectiveTo boundary in this feature uses (the edit route
  // closes a row with todayAtMidnightUtc() too, and the cron's own
  // effectiveFrom <= today filter compares against midnight). Mixing a
  // full-precision effectiveFrom here with midnight-truncated boundaries
  // elsewhere would make a same-day edit produce effectiveTo (midnight)
  // earlier than effectiveFrom (this afternoon) — an invalid interval that
  // a same-day cron re-run would silently exclude from "active as of
  // today." lib/modelPortfolios/detail.ts's hasFullHistory check still
  // works the same way: midnight-of-creation-day is always <= createdAt
  // itself, same-day or not.
  const now = new Date();
  const today = todayAtMidnightUtc();

  const modelPortfolio = await prisma.modelPortfolio.create({
    data: {
      organizationId: ctx.organizationId,
      createdByUserId: ctx.userId,
      name,
      createdAt: now,
      holdings: {
        createMany: {
          data: validated.holdings.map((h, i) => ({
            assetType: h.assetType,
            symbol: h.symbol,
            name: h.name ?? null,
            targetWeightPercent: h.targetWeightPercent,
            priceAtCreation: priceResults[i]!.price,
            effectiveFrom: today,
          })),
        },
      },
    },
    include: { holdings: true },
  });

  // Seeds day 0 — both the portfolio-level snapshot (so tomorrow's cron
  // finds a real "yesterday" value instead of special-casing "none exists
  // yet") and each holding's own day-0 price (so tomorrow's chained return
  // has a real prior-day price to compare against, not just priceAtCreation
  // sitting unrecorded in ModelPortfolioHolding).
  await prisma.$transaction([
    prisma.modelPortfolioSnapshot.create({
      data: { modelPortfolioId: modelPortfolio.id, asOfDate: today, value: NOTIONAL_BASE },
    }),
    prisma.modelPortfolioHoldingSnapshot.createMany({
      data: validated.holdings.map((h, i) => ({
        modelPortfolioId: modelPortfolio.id,
        symbol: h.symbol,
        asOfDate: today,
        price: priceResults[i]!.price,
      })),
    }),
  ]);

  return NextResponse.json({ modelPortfolio });
}
