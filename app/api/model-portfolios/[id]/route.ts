import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentPrice, type AssetType } from "@/lib/simulatedTrading/pricing";
import { getModelPortfolioDetail } from "@/lib/modelPortfolios/detail";
import { requirePortfolioAccess } from "@/lib/modelPortfolios/access";

export const dynamic = "force-dynamic";

const ASSET_TYPES = ["stock", "commodity", "crypto"];
const WEIGHT_SUM_EPSILON = 0.01;

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

    const existing = await prisma.modelPortfolioHolding.findMany({
      where: { modelPortfolioId: id },
      select: { assetType: true, symbol: true, priceAtCreation: true },
    });
    const existingByKey = new Map(existing.map((h) => [`${h.assetType}:${h.symbol}`, h.priceAtCreation]));

    // Only genuinely NEW (assetType, symbol) pairs get a fresh live-price
    // fetch — an unchanged holding keeps its original priceAtCreation so
    // history isn't retroactively rewritten (see the plan's "forward-only"
    // editing note). Weight-only changes on an existing symbol are free.
    const needsFreshPrice = validated.holdings.filter((h) => !existingByKey.has(`${h.assetType}:${h.symbol}`));
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

    await prisma.$transaction([
      prisma.modelPortfolioHolding.deleteMany({ where: { modelPortfolioId: id } }),
      prisma.modelPortfolioHolding.createMany({
        data: validated.holdings.map((h) => ({
          modelPortfolioId: id,
          assetType: h.assetType,
          symbol: h.symbol,
          name: h.name ?? null,
          targetWeightPercent: h.targetWeightPercent,
          priceAtCreation: existingByKey.get(`${h.assetType}:${h.symbol}`) ?? freshPriceByKey.get(`${h.assetType}:${h.symbol}`)!,
        })),
      }),
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
