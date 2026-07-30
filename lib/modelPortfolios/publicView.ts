import { prisma } from "@/lib/prisma";
import { NOTIONAL_BASE, computeLiveValue } from "@/lib/modelPortfolios/valuation";

// Same tolerance/reasoning as lib/modelPortfolios/detail.ts's own constant —
// kept as a separate copy rather than a shared import so this file's
// deliberately-minimal dependency footprint (see its own header note) isn't
// widened just to share one number.
const FULL_HISTORY_TOLERANCE_MS = 5000;

// Deliberately minimal, explicitly-typed — every field is named here, never
// "whatever the internal model returns." Absent on purpose: the real
// ModelPortfolio.id, organizationId, createdByUserId/advisor name or email,
// priceAtCreation per holding (internal reference data), share-link id/
// active state, and anything about the advisor's OTHER portfolios (this
// query is scoped to exactly one row, by token — nothing else is ever
// fetched).
export interface PublicShareHolding {
  symbol: string;
  name: string | null;
  targetWeightPercent: number;
}

export interface PublicShareView {
  portfolioName: string;
  // The firm's name — the intended "who is this from." Never the
  // individual advisor's personal name or email.
  organizationName: string;
  holdings: PublicShareHolding[];
  performanceSeries: { date: string; value: number }[];
  totalValue: number;
  notionalBase: number;
  // Null when this portfolio predates chain-linked weight-history tracking
  // — see lib/modelPortfolios/detail.ts's matching field for why this is
  // suppressed rather than shown with a caveat.
  totalReturnPercent: number | null;
  trackingStartsAt: string | null;
  asOfDate: string;
}

// Looks up by TOKEN ALONE — never by portfolio id, so there is no
// "id-with-token-as-an-afterthought" IDOR pattern to get wrong. Returns
// null (never a partial/degraded object) whenever the link doesn't exist
// OR is inactive, so a revoked link and a never-existed link are
// indistinguishable from the outside.
export async function getPublicShareView(token: string): Promise<PublicShareView | null> {
  const link = await prisma.modelPortfolioShareLink.findUnique({
    where: { token },
    select: {
      active: true,
      modelPortfolio: {
        select: {
          id: true,
          name: true,
          createdAt: true,
          organization: { select: { name: true } },
          holdings: {
            select: { assetType: true, symbol: true, name: true, targetWeightPercent: true, effectiveFrom: true, effectiveTo: true },
          },
          snapshots: { select: { asOfDate: true, value: true }, orderBy: { asOfDate: "asc" } },
        },
      },
    },
  });

  if (!link || !link.active) return null;

  const mp = link.modelPortfolio;
  const activeHoldings = mp.holdings.filter((h) => h.effectiveTo === null);
  const { totalValue } = await computeLiveValue(mp.id, activeHoldings);

  const earliestEffectiveFrom = mp.holdings.reduce(
    (min, h) => (h.effectiveFrom.getTime() < min.getTime() ? h.effectiveFrom : min),
    mp.holdings[0]?.effectiveFrom ?? mp.createdAt
  );
  const hasFullHistory = earliestEffectiveFrom.getTime() <= mp.createdAt.getTime() + FULL_HISTORY_TOLERANCE_MS;

  let totalReturnPercent: number | null = null;
  let performanceSeries: { date: string; value: number }[];
  let trackingStartsAt: string | null = null;

  if (hasFullHistory) {
    totalReturnPercent = ((totalValue - NOTIONAL_BASE) / NOTIONAL_BASE) * 100;
    performanceSeries = [
      { date: mp.createdAt.toISOString(), value: NOTIONAL_BASE },
      ...mp.snapshots.map((s) => ({ date: s.asOfDate.toISOString(), value: s.value })),
      { date: new Date().toISOString(), value: totalValue },
    ];
  } else {
    trackingStartsAt = earliestEffectiveFrom.toISOString();
    const cleanSnapshots = mp.snapshots.filter((s) => s.asOfDate.getTime() >= earliestEffectiveFrom.getTime());
    performanceSeries = [
      ...cleanSnapshots.map((s) => ({ date: s.asOfDate.toISOString(), value: s.value })),
      { date: new Date().toISOString(), value: totalValue },
    ];
  }

  return {
    portfolioName: mp.name,
    organizationName: mp.organization.name,
    holdings: activeHoldings.map((h) => ({
      symbol: h.symbol,
      name: h.name,
      targetWeightPercent: h.targetWeightPercent,
    })),
    performanceSeries,
    totalValue,
    notionalBase: NOTIONAL_BASE,
    totalReturnPercent,
    trackingStartsAt,
    asOfDate: new Date().toISOString(),
  };
}
