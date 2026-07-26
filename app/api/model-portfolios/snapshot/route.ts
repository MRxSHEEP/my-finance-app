import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkCronAuth } from "@/lib/trackers/cronAuth";
import { computeCurrentValue } from "@/lib/modelPortfolios/valuation";

export const dynamic = "force-dynamic";

// Byte-for-byte the same shape as app/api/simulated-portfolio/snapshot/route.ts
// — idempotent via ModelPortfolioSnapshot's @@unique([modelPortfolioId, asOfDate]),
// so a retried/duplicate cron firing on the same day just no-ops for
// portfolios already snapshotted today. Uses whatever target weights are
// CURRENTLY stored, so an edit made after today's snapshot only affects
// tomorrow's onward — already-stored snapshots are never rewritten.
function todayAtMidnightUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export async function GET(request: NextRequest) {
  const authError = checkCronAuth(request);
  if (authError) return authError;

  const asOfDate = todayAtMidnightUtc();
  const portfolios = await prisma.modelPortfolio.findMany({ include: { holdings: true } });

  let snapshotsCreated = 0;

  for (const portfolio of portfolios) {
    const existing = await prisma.modelPortfolioSnapshot.findUnique({
      where: { modelPortfolioId_asOfDate: { modelPortfolioId: portfolio.id, asOfDate } },
    });
    if (existing) continue;

    const value = await computeCurrentValue(portfolio.holdings);
    await prisma.modelPortfolioSnapshot.create({
      data: { modelPortfolioId: portfolio.id, asOfDate, value },
    });
    snapshotsCreated++;
  }

  return NextResponse.json({ portfoliosProcessed: portfolios.length, snapshotsCreated });
}
