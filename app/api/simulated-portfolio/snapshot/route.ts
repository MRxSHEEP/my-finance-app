import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkCronAuth } from "@/lib/trackers/cronAuth";
import { getCurrentPrice, type AssetType } from "@/lib/simulatedTrading/pricing";

export const dynamic = "force-dynamic";

// Daily total-value snapshot for every simulated portfolio's performance
// chart — mirrors lib/trackers/thirteenF.ts's own
// backfillPerformanceHistory/TrackerPerformanceSnapshot pattern. Idempotent
// via SimulatedPortfolioSnapshot's @@unique([portfolioId, asOfDate]), so a
// retried/duplicate cron firing on the same day just no-ops for portfolios
// already snapshotted today.
function todayAtMidnightUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export async function GET(request: NextRequest) {
  const authError = checkCronAuth(request);
  if (authError) return authError;

  const asOfDate = todayAtMidnightUtc();
  const portfolios = await prisma.simulatedPortfolio.findMany({ include: { holdings: true } });

  let snapshotsCreated = 0;

  for (const portfolio of portfolios) {
    const existing = await prisma.simulatedPortfolioSnapshot.findUnique({
      where: { portfolioId_asOfDate: { portfolioId: portfolio.id, asOfDate } },
    });
    if (existing) continue;

    const priceResults = await Promise.all(
      portfolio.holdings.map((h) => getCurrentPrice(h.assetType as AssetType, h.symbol))
    );
    const holdingsValue = portfolio.holdings.reduce((sum, h, i) => {
      const priceResult = priceResults[i];
      const value = priceResult ? h.quantity * priceResult.price : h.quantity * h.averageCostBasis;
      return sum + value;
    }, 0);

    await prisma.simulatedPortfolioSnapshot.create({
      data: { portfolioId: portfolio.id, asOfDate, totalValue: portfolio.cashBalance + holdingsValue },
    });
    snapshotsCreated++;
  }

  return NextResponse.json({ portfoliosProcessed: portfolios.length, snapshotsCreated });
}
