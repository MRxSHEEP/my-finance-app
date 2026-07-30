import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentPrice, type AssetType } from "@/lib/simulatedTrading/pricing";
import { getModelPortfolioDetail } from "@/lib/modelPortfolios/detail";
import { requirePortfolioAccess } from "@/lib/modelPortfolios/access";
import { WEIGHT_SUM_EPSILON, todayAtMidnightUtc } from "@/lib/modelPortfolios/constants";

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

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requirePortfolioAccess(id);
  if (access.error) return access.error;

  const detail = await getModelPortfolioDetail(id);
  if (!detail) return NextResponse.json({ error: "Model portfolio not found" }, { status: 404 });
  return NextResponse.json(detail);
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requirePortfolioAccess(id);
  if (access.error) return access.error;

  const body = await request.json().catch(() => null);
  const data: { name?: string } = {};

  if (typeof body?.name === "string") {
    const name = body.name.trim();
    if (!name) return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 });
    data.name = name;
  }

  if (body?.holdings !== undefined) {
    const validated = validateHoldings(body.holdings);
    if ("error" in validated) return NextResponse.json({ error: validated.error }, { status: 400 });

    // Only the CURRENTLY ACTIVE row per symbol counts as "existing" — a
    // symbol that was previously removed (its old row already closed) and
    // is now being re-added is treated as a genuinely new position with a
    // fresh priceAtCreation, not a continuation of its old, stale one.
    const activeHoldings = await prisma.modelPortfolioHolding.findMany({
      where: { modelPortfolioId: id, effectiveTo: null },
      select: { assetType: true, symbol: true, priceAtCreation: true, targetWeightPercent: true },
    });
    const activeByKey = new Map(activeHoldings.map((h) => [`${h.assetType}:${h.symbol}`, h]));
    const newKeys = new Set(validated.holdings.map((h) => `${h.assetType}:${h.symbol}`));

    // Only genuinely NEW (assetType, symbol) pairs get a fresh live-price
    // fetch — an unchanged or reweighted EXISTING holding keeps its
    // original priceAtCreation so history isn't retroactively rewritten
    // (see the plan's "forward-only" editing note).
    const needsFreshPrice = validated.holdings.filter((h) => !activeByKey.has(`${h.assetType}:${h.symbol}`));
    const freshPrices = await Promise.all(
      needsFreshPrice.map((h) => getCurrentPrice(h.assetType as AssetType, h.symbol))
    );
    const missingIndex = freshPrices.findIndex((r) => !r);
    if (missingIndex !== -1) {
      return NextResponse.json(
        { error: `Price unavailable for ${needsFreshPrice[missingIndex].symbol} — try again` },
        { status: 400 }
      );
    }
    const freshPriceByKey = new Map(needsFreshPrice.map((h, i) => [`${h.assetType}:${h.symbol}`, freshPrices[i]!.price]));

    const today = todayAtMidnightUtc();

    // Effective-dated versioning, not delete-and-recreate: a row for a
    // symbol whose weight didn't change is left untouched (no spurious
    // version boundary); a changed, removed, or brand-new symbol closes its
    // old row (if any) and/or opens a new one dated today. This is what
    // makes a weight edit affect only the return computed from today
    // forward — every prior day's chained value is already persisted and
    // untouched by this transaction.
    const toClose: string[] = []; // (assetType, symbol) keys whose active row should close
    const toCreate: typeof validated.holdings = [];

    for (const h of validated.holdings) {
      const key = `${h.assetType}:${h.symbol}`;
      const active = activeByKey.get(key);
      if (!active) {
        toCreate.push(h); // brand new position
      } else if (active.targetWeightPercent !== h.targetWeightPercent) {
        // Both sides are decimal literals (stored value vs. fresh
        // client-submitted value), not the result of accumulated
        // arithmetic, so a strict compare is safe here — no float-noise
        // tolerance needed the way WEIGHT_SUM_EPSILON's sum check does.
        toClose.push(key); // reweighted — close old, open new
        toCreate.push(h);
      }
      // else: unchanged weight, leave the existing active row exactly as is
    }
    for (const key of activeByKey.keys()) {
      if (!newKeys.has(key)) toClose.push(key); // removed from the portfolio entirely
    }

    await prisma.$transaction([
      ...toClose.map((key) => {
        const [assetType, symbol] = key.split(":");
        return prisma.modelPortfolioHolding.updateMany({
          where: { modelPortfolioId: id, assetType, symbol, effectiveTo: null },
          data: { effectiveTo: today },
        });
      }),
      ...(toCreate.length > 0
        ? [
            prisma.modelPortfolioHolding.createMany({
              data: toCreate.map((h) => ({
                modelPortfolioId: id,
                assetType: h.assetType,
                symbol: h.symbol,
                name: h.name ?? null,
                targetWeightPercent: h.targetWeightPercent,
                priceAtCreation:
                  activeByKey.get(`${h.assetType}:${h.symbol}`)?.priceAtCreation ?? freshPriceByKey.get(`${h.assetType}:${h.symbol}`)!,
                effectiveFrom: today,
              })),
            }),
          ]
        : []),
    ]);
  }

  if (Object.keys(data).length > 0) {
    await prisma.modelPortfolio.update({ where: { id }, data });
  }

  const detail = await getModelPortfolioDetail(id);
  return NextResponse.json(detail);
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requirePortfolioAccess(id);
  if (access.error) return access.error;

  await prisma.modelPortfolio.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
