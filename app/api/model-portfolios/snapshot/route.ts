import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkCronAuth } from "@/lib/trackers/cronAuth";
import { fetchHoldingPrices, computeChainedDailyValue } from "@/lib/modelPortfolios/valuation";
import { NOTIONAL_BASE, todayAtMidnightUtc } from "@/lib/modelPortfolios/constants";

export const dynamic = "force-dynamic";

// Idempotent via ModelPortfolioSnapshot's @@unique([modelPortfolioId,
// asOfDate]), so a retried/duplicate cron firing on the same day just
// no-ops for portfolios already snapshotted today.
//
// Chain-linked, not recomputed from inception: today's value is
// yesterday's STORED value times today's weighted return (each active
// holding's own price yesterday vs. today, from ModelPortfolioHoldingSnapshot
// — never priceAtCreation from however long ago the holding was first
// added). Uses whichever holdings are effective as of today (effectiveFrom
// <= today, effectiveTo null or > today), so an edit made earlier today
// affects today's own return — but every EARLIER day's already-stored
// snapshot is never touched, which is exactly what makes a weight edit
// unable to retroactively change history the way the old
// value(t) = weight_now * (price(t)/priceAtCreation) formula could.
export async function GET(request: NextRequest) {
  const authError = checkCronAuth(request);
  if (authError) return authError;

  const today = todayAtMidnightUtc();
  const yesterday = new Date(today);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);

  const portfolios = await prisma.modelPortfolio.findMany({
    include: { holdings: { where: { effectiveFrom: { lte: today }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: today } }] } } },
  });

  let snapshotsCreated = 0;

  for (const portfolio of portfolios) {
    const existingSnapshot = await prisma.modelPortfolioSnapshot.findUnique({
      where: { modelPortfolioId_asOfDate: { modelPortfolioId: portfolio.id, asOfDate: today } },
    });
    if (existingSnapshot) continue;

    const activeHoldings = portfolio.holdings;
    if (activeHoldings.length === 0) continue; // portfolio has no active holdings at all — nothing to value

    const currentPrices = await fetchHoldingPrices(activeHoldings);
    const currentPricesBySymbol = Object.fromEntries(
      activeHoldings.map((h, i) => [h.symbol, currentPrices[i]]).filter((entry): entry is [string, number] => entry[1] != null)
    );

    const yesterdaySnapshot = await prisma.modelPortfolioSnapshot.findUnique({
      where: { modelPortfolioId_asOfDate: { modelPortfolioId: portfolio.id, asOfDate: yesterday } },
    });
    const yesterdayHoldingPrices = await prisma.modelPortfolioHoldingSnapshot.findMany({
      where: { modelPortfolioId: portfolio.id, asOfDate: yesterday },
    });
    const previousPricesBySymbol = Object.fromEntries(yesterdayHoldingPrices.map((s) => [s.symbol, s.price]));

    const value = yesterdaySnapshot
      ? computeChainedDailyValue(yesterdaySnapshot.value, activeHoldings, previousPricesBySymbol, currentPricesBySymbol)
      : NOTIONAL_BASE; // no prior snapshot at all (shouldn't normally happen — creation seeds day 0 — but never fail the whole run over it)

    await prisma.$transaction([
      prisma.modelPortfolioSnapshot.create({ data: { modelPortfolioId: portfolio.id, asOfDate: today, value } }),
      prisma.modelPortfolioHoldingSnapshot.createMany({
        data: Object.entries(currentPricesBySymbol).map(([symbol, price]) => ({
          modelPortfolioId: portfolio.id,
          symbol,
          asOfDate: today,
          price,
        })),
      }),
    ]);
    snapshotsCreated++;
  }

  return NextResponse.json({ portfoliosProcessed: portfolios.length, snapshotsCreated });
}
