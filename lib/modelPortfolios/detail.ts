import { prisma } from "@/lib/prisma";
import { NOTIONAL_BASE, computeLiveValue } from "@/lib/modelPortfolios/valuation";

// How close a portfolio's earliest-ever weight-history row needs to be to
// its own createdAt to count as "created under full chain-linked tracking"
// — new portfolios set both to the exact same captured instant (see the
// create route), so this only needs to absorb driver-level timestamp
// rounding, not any real gap.
const FULL_HISTORY_TOLERANCE_MS = 5000;

export interface ModelPortfolioHoldingOut {
  id: string;
  assetType: string;
  symbol: string;
  name: string | null;
  targetWeightPercent: number;
  priceAtCreation: number;
  currentPrice: number | null;
  priceUnavailable: boolean;
}

export interface ModelPortfolioDetail {
  modelPortfolio: {
    id: string;
    organizationId: string;
    createdByUserId: string;
    name: string;
    createdAt: string;
    updatedAt: string;
  };
  holdings: ModelPortfolioHoldingOut[];
  totalValue: number;
  // Null when this portfolio predates chain-linked weight-history tracking
  // (see hasFullHistory below) — a labeled-but-unreliable number is still a
  // number someone can act on, so the UI shows a "tracking starts" message
  // instead of a figure rather than a caveated one.
  totalReturn: number | null;
  totalReturnPercent: number | null;
  performanceSeries: { date: string; value: number }[];
  // Only set when totalReturn is null — the date the UI should say
  // performance tracking began.
  trackingStartsAt: string | null;
  shareLink: { token: string; active: boolean } | null;
}

// The AUTHENTICATED owner/admin view — every field, including internal
// reference data (priceAtCreation) and share-link status. Contrast with
// lib/modelPortfolios/publicView.ts's getPublicShareView, which returns a
// deliberately minimal, explicitly-typed subset for the public route. Both
// call the same computeLiveValue function so the numbers can never drift
// between the two surfaces — mirrors getSimulatedPortfolioDetail's "one
// shared computation, multiple differently-scoped callers" precedent.
export async function getModelPortfolioDetail(id: string): Promise<ModelPortfolioDetail | null> {
  const mp = await prisma.modelPortfolio.findUnique({
    where: { id },
    include: {
      holdings: true, // ALL rows, active and historical — trackingStartsAt needs the full history
      snapshots: { orderBy: { asOfDate: "asc" } },
      shareLink: true,
    },
  });
  if (!mp) return null;

  const activeHoldings = mp.holdings.filter((h) => h.effectiveTo === null);
  const { totalValue, currentPrices } = await computeLiveValue(mp.id, activeHoldings);

  const holdings: ModelPortfolioHoldingOut[] = activeHoldings.map((h, i) => ({
    id: h.id,
    assetType: h.assetType,
    symbol: h.symbol,
    name: h.name,
    targetWeightPercent: h.targetWeightPercent,
    priceAtCreation: h.priceAtCreation,
    currentPrice: currentPrices[i],
    priceUnavailable: currentPrices[i] == null,
  }));

  // The earliest weight-history row across this portfolio's ENTIRE history
  // (not just currently-active holdings) — a portfolio edited many times
  // still traces back to its true first tracked day this way.
  const earliestEffectiveFrom = mp.holdings.reduce(
    (min, h) => (h.effectiveFrom.getTime() < min.getTime() ? h.effectiveFrom : min),
    mp.holdings[0]?.effectiveFrom ?? mp.createdAt
  );
  const hasFullHistory = earliestEffectiveFrom.getTime() <= mp.createdAt.getTime() + FULL_HISTORY_TOLERANCE_MS;

  let totalReturn: number | null = null;
  let totalReturnPercent: number | null = null;
  let performanceSeries: { date: string; value: number }[];
  let trackingStartsAt: string | null = null;

  if (hasFullHistory) {
    totalReturn = totalValue - NOTIONAL_BASE;
    totalReturnPercent = (totalReturn / NOTIONAL_BASE) * 100;
    // Always at least 2 points (creation baseline + right now) even before
    // the daily snapshot cron has ever run.
    performanceSeries = [
      { date: mp.createdAt.toISOString(), value: NOTIONAL_BASE },
      ...mp.snapshots.map((s) => ({ date: s.asOfDate.toISOString(), value: s.value })),
      { date: new Date().toISOString(), value: totalValue },
    ];
  } else {
    // Pre-migration portfolio — its since-inception return was computed
    // under the old, retroactively-editable formula and can't be trusted
    // or reconstructed. Suppress the figure entirely (not caveated) and
    // only chart the portion from the point chain-linked tracking actually
    // began, using each snapshot's own stored value rather than an
    // artificial reset to NOTIONAL_BASE.
    trackingStartsAt = earliestEffectiveFrom.toISOString();
    const cleanSnapshots = mp.snapshots.filter((s) => s.asOfDate.getTime() >= earliestEffectiveFrom.getTime());
    performanceSeries = [
      ...cleanSnapshots.map((s) => ({ date: s.asOfDate.toISOString(), value: s.value })),
      { date: new Date().toISOString(), value: totalValue },
    ];
  }

  return {
    modelPortfolio: {
      id: mp.id,
      organizationId: mp.organizationId,
      createdByUserId: mp.createdByUserId,
      name: mp.name,
      createdAt: mp.createdAt.toISOString(),
      updatedAt: mp.updatedAt.toISOString(),
    },
    holdings,
    totalValue,
    totalReturn,
    totalReturnPercent,
    performanceSeries,
    trackingStartsAt,
    shareLink: mp.shareLink ? { token: mp.shareLink.token, active: mp.shareLink.active } : null,
  };
}
