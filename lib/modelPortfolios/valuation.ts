import { getCurrentPrice, type AssetType } from "@/lib/simulatedTrading/pricing";
import { NOTIONAL_BASE } from "@/lib/modelPortfolios/constants";

export { NOTIONAL_BASE };

export interface ModelPortfolioHoldingLike {
  assetType: string;
  symbol: string;
  targetWeightPercent: number;
  priceAtCreation: number;
}

// One price fetch per holding, reused by both a per-holding display (which
// price was fetched, was it available) and the total-value formula below —
// callers that need both should fetch once via this and pass the result to
// computeValueFromPrices, rather than fetching twice.
export async function fetchHoldingPrices(holdings: ModelPortfolioHoldingLike[]): Promise<(number | null)[]> {
  const results = await Promise.all(holdings.map((h) => getCurrentPrice(h.assetType as AssetType, h.symbol)));
  return results.map((r) => r?.price ?? null);
}

// Fixed target weights, continuously rebalanced — every holding's target
// weight is reapplied fresh at every valuation, so weights never drift
// between rebalances (see the plan's rebalancing decision). value(t) =
// NOTIONAL_BASE * Σ [ targetWeight_h * (price_h(t) / price_h(t0)) ], where
// t0 is each holding's own priceAtCreation. If a holding's live price is
// temporarily unavailable, it falls back to contributing exactly its
// target weight with zero implied change (ratio of 1) — same
// graceful-degradation spirit as getSimulatedPortfolioDetail's book-value
// fallback, rather than failing the whole computation.
export function computeValueFromPrices(holdings: ModelPortfolioHoldingLike[], prices: (number | null)[]): number {
  const weightedRatioSum = holdings.reduce((sum, h, i) => {
    const currentPrice = prices[i];
    const ratio = currentPrice != null && h.priceAtCreation > 0 ? currentPrice / h.priceAtCreation : 1;
    return sum + (h.targetWeightPercent / 100) * ratio;
  }, 0);

  return NOTIONAL_BASE * weightedRatioSum;
}

// Convenience wrapper for callers that only need the total (e.g. the
// snapshot cron) — fetches prices itself.
export async function computeCurrentValue(holdings: ModelPortfolioHoldingLike[]): Promise<number> {
  if (holdings.length === 0) return NOTIONAL_BASE;
  const prices = await fetchHoldingPrices(holdings);
  return computeValueFromPrices(holdings, prices);
}
