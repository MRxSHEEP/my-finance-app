import type { GeneratedNewsDataSnapshot } from "@/lib/generatedNews/types";

// The fixed, closed vocabulary of numeric facts a generated article may
// cite — shared between the prompt (lib/generatedNews/generate.ts, which
// tells Claude which of these fields have real data for THIS ticker) and
// the fact-check (lib/generatedNews/factCheck.ts, which validates every
// CITED_FACTS line against the real pool for its field). A field absent
// from the returned map means the underlying data was null/empty for this
// ticker — citing it anyway is an automatic fact-check failure, since it
// means the model referenced a data category it was never given.
export type FactPools = Record<string, number[]>;

function nonNull(values: Array<number | null>): number[] {
  return values.filter((v): v is number => v !== null);
}

export function buildFactPools(data: GeneratedNewsDataSnapshot): FactPools {
  const pools: FactPools = {};
  const { technical, analystRating, earnings, insiderActivity, congressActivity } = data;

  if (technical.latestClose !== null) pools.latestClose = [technical.latestClose];
  if (technical.sma50 !== null) pools.sma50 = [technical.sma50];
  if (technical.sma200 !== null) pools.sma200 = [technical.sma200];
  if (technical.rsi14 !== null) pools.rsi14 = [technical.rsi14];
  if (technical.volumeTrendPercent !== null) pools.volumeTrend = [technical.volumeTrendPercent];

  if (analystRating && analystRating.rating !== null) pools.analystRating = [analystRating.rating];

  if (earnings) {
    const actuals = nonNull(earnings.recentQuarters.map((q) => q.actual));
    const estimates = nonNull(earnings.recentQuarters.map((q) => q.estimate));
    const surprises = nonNull(earnings.recentQuarters.map((q) => q.surprisePercent));
    if (actuals.length > 0) pools.earningsActual = actuals;
    if (estimates.length > 0) pools.earningsEstimate = estimates;
    if (surprises.length > 0) pools.earningsSurprise = surprises;
  }

  const insiderValues = nonNull(insiderActivity.map((a) => a.exactValue));
  const insiderShares = nonNull(insiderActivity.map((a) => a.shares));
  if (insiderValues.length > 0) pools.insiderValue = insiderValues;
  if (insiderShares.length > 0) pools.insiderShares = insiderShares;

  const congressLow = nonNull(congressActivity.map((a) => a.amountLow));
  const congressHigh = nonNull(congressActivity.map((a) => a.amountHigh));
  if (congressLow.length > 0) pools.congressAmountLow = congressLow;
  if (congressHigh.length > 0) pools.congressAmountHigh = congressHigh;

  return pools;
}

// Generous enough to tolerate Claude's own prose rounding (e.g. writing
// "$187" for a stored 187.32, or "+12.3%" for a stored 12.34) without being
// so loose that a genuinely different number would slip through.
export function valueMatchesPool(cited: number, pool: number[]): boolean {
  return pool.some((real) => Math.abs(cited - real) <= Math.max(0.05, Math.abs(real) * 0.01));
}

export const FACT_FIELD_LABELS: Record<string, string> = {
  latestClose: "the latest closing/spot price",
  sma50: "the 50-day simple moving average",
  sma200: "the 200-day simple moving average",
  rsi14: "the 14-day RSI",
  volumeTrend: "the recent-vs-baseline volume trend percentage",
  analystRating: "the analyst rating (1-5 scale)",
  earningsActual: "a reported quarterly earnings actual figure",
  earningsEstimate: "a quarterly earnings estimate figure",
  earningsSurprise: "a quarterly earnings surprise percentage",
  insiderValue: "an insider transaction's dollar value",
  insiderShares: "an insider transaction's share count",
  congressAmountLow: "a congressional transaction's disclosed low-end amount",
  congressAmountHigh: "a congressional transaction's disclosed high-end amount",
};
