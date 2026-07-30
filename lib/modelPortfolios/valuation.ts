import { prisma } from "@/lib/prisma";
import { getCurrentPrice, type AssetType } from "@/lib/simulatedTrading/pricing";
import { NOTIONAL_BASE, todayAtMidnightUtc } from "@/lib/modelPortfolios/constants";

export { NOTIONAL_BASE };

export interface ActiveHoldingLike {
  assetType: string;
  symbol: string;
  targetWeightPercent: number;
}

// One price fetch per holding, reused by both a per-holding display (which
// price was fetched, was it available) and the chain-linked formula below —
// callers that need both should fetch once via this and pass the result on,
// rather than fetching twice.
export async function fetchHoldingPrices(holdings: ActiveHoldingLike[]): Promise<(number | null)[]> {
  const results = await Promise.all(holdings.map((h) => getCurrentPrice(h.assetType as AssetType, h.symbol)));
  return results.map((r) => r?.price ?? null);
}

// Chain-linked daily valuation: a given day's value is the PRIOR day's
// already-stored value times that day's weighted return, using each active
// holding's own price on the prior day vs. today — never recomputed from
// inception. This is what actually closes the "editing a weight
// retroactively inflates the whole since-inception history" defect the old
// value(t) = weight_now * (price(t)/priceAtCreation) formula had: a weight
// change can only ever affect the return computed from this point forward,
// because every prior day's value is already persisted and untouched.
//
// A holding missing from previousPricesBySymbol (a brand-new position with
// no prior-day price on record yet) or currentPricesBySymbol (a fetch
// failure) falls back to a 1.0 ratio — no implied change for that one day —
// same graceful-degradation spirit as the old formula's missing-price
// fallback, rather than failing the whole computation.
export function computeChainedDailyValue(
  previousValue: number,
  activeHoldings: ActiveHoldingLike[],
  previousPricesBySymbol: Record<string, number>,
  currentPricesBySymbol: Record<string, number>
): number {
  const weightedReturn = activeHoldings.reduce((sum, h) => {
    const prevPrice = previousPricesBySymbol[h.symbol];
    const currPrice = currentPricesBySymbol[h.symbol];
    const ratio = prevPrice != null && prevPrice > 0 && currPrice != null ? currPrice / prevPrice : 1;
    return sum + (h.targetWeightPercent / 100) * ratio;
  }, 0);

  return previousValue * weightedReturn;
}

export interface LiveValueResult {
  totalValue: number;
  // Parallel to activeHoldings, same shape fetchHoldingPrices returns — so
  // a caller needing both the aggregate and the per-holding display price
  // (e.g. detail.ts's holdings table) only fetches once, not twice. Fetching
  // twice risked the two calls landing on slightly different live quotes,
  // which would make the displayed per-holding price and the computed
  // total silently disagree.
  currentPrices: (number | null)[];
}

// Shared by both the authenticated detail view and the public share view —
// "right now" is always computed live (prices keep moving intraday even
// after today's cron has already run), chained off whichever prior stored
// snapshot is actually available: yesterday's, if the portfolio existed
// then, otherwise today's own creation-day seed (see the create route —
// every portfolio gets a day-0 snapshot the moment it's made, so this
// fallback only matters for a portfolio being viewed the same day it was
// created). Never recomputes from inception.
export async function computeLiveValue(modelPortfolioId: string, activeHoldings: ActiveHoldingLike[]): Promise<LiveValueResult> {
  if (activeHoldings.length === 0) return { totalValue: NOTIONAL_BASE, currentPrices: [] };

  const today = todayAtMidnightUtc();
  const yesterday = new Date(today);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);

  const [currentPrices, yesterdaySnapshot, yesterdayHoldingPrices] = await Promise.all([
    fetchHoldingPrices(activeHoldings),
    prisma.modelPortfolioSnapshot.findUnique({
      where: { modelPortfolioId_asOfDate: { modelPortfolioId, asOfDate: yesterday } },
    }),
    prisma.modelPortfolioHoldingSnapshot.findMany({ where: { modelPortfolioId, asOfDate: yesterday } }),
  ]);
  const currentPricesBySymbol = Object.fromEntries(
    activeHoldings.map((h, i) => [h.symbol, currentPrices[i]]).filter((entry): entry is [string, number] => entry[1] != null)
  );

  let baselineSnapshot = yesterdaySnapshot;
  let baselineHoldingPrices = yesterdayHoldingPrices;
  if (!baselineSnapshot) {
    // No "yesterday" (portfolio created today) — fall back to today's own
    // creation-day seed as the baseline instead.
    [baselineSnapshot, baselineHoldingPrices] = await Promise.all([
      prisma.modelPortfolioSnapshot.findUnique({ where: { modelPortfolioId_asOfDate: { modelPortfolioId, asOfDate: today } } }),
      prisma.modelPortfolioHoldingSnapshot.findMany({ where: { modelPortfolioId, asOfDate: today } }),
    ]);
  }
  if (!baselineSnapshot) return { totalValue: NOTIONAL_BASE, currentPrices }; // shouldn't happen — creation always seeds day 0 — but never fail the view over it

  const previousPricesBySymbol = Object.fromEntries(baselineHoldingPrices.map((s) => [s.symbol, s.price]));
  const totalValue = computeChainedDailyValue(baselineSnapshot.value, activeHoldings, previousPricesBySymbol, currentPricesBySymbol);
  return { totalValue, currentPrices };
}
