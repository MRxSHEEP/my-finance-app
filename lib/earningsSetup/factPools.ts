import type { EarningsSetupDataSnapshot } from "@/lib/earningsSetup/types";

// The fixed, closed vocabulary of numeric facts a generated narrative may
// cite — shared between the prompt (lib/earningsSetup/generate.ts, which
// tells Claude which of these fields have real data for THIS earnings
// event) and the fact-check (lib/earningsSetup/factCheck.ts, which
// validates every CITED_FACTS line against the real pool for its field).
// A field absent from the returned map means the underlying data was
// null/empty for this ticker — citing it anyway is an automatic
// fact-check failure. Same pattern as lib/generatedNews/factPools.ts.
export type FactPools = Record<string, number[]>;

function nonNull(values: Array<number | null | undefined>): number[] {
  return values.filter((v): v is number => v !== null && v !== undefined);
}

export function buildFactPools(data: EarningsSetupDataSnapshot): FactPools {
  const pools: FactPools = {};

  if (data.analystConsensus) {
    const c = data.analystConsensus;
    pools.analystRating = [c.rating];
    pools.strongBuyCount = [c.strongBuy];
    pools.buyCount = [c.buy];
    pools.holdCount = [c.hold];
    pools.sellCount = [c.sell];
    pools.strongSellCount = [c.strongSell];
    pools.totalAnalysts = [c.totalAnalysts];
  }

  if (data.priceTarget) {
    pools.priceTargetLow = [data.priceTarget.low];
    pools.priceTargetAverage = [data.priceTarget.average];
    pools.priceTargetHigh = [data.priceTarget.high];
    pools.priceTargetImpliedChange = [data.priceTarget.impliedChangePercent];
  }

  if (data.currentPrice !== null) pools.currentPrice = [data.currentPrice];

  const thisQuarter = data.earningsHistory.find((q) => q.period === data.reportDate) ?? data.earningsHistory[data.earningsHistory.length - 1];
  if (thisQuarter) {
    if (thisQuarter.actual !== null) pools.reportedEps = [thisQuarter.actual];
    if (thisQuarter.estimate !== null) pools.estimatedEps = [thisQuarter.estimate];
    if (thisQuarter.surprisePercent !== null) pools.epsSurprisePercent = [thisQuarter.surprisePercent];
  }

  if (data.beatStreak) {
    pools.beatStreakBeats = [data.beatStreak.beats];
    pools.beatStreakTotal = [data.beatStreak.total];
  }

  if (data.priceReaction) {
    pools.reportDayReactionPercent = [data.priceReaction.reportDayReactionPercent];
    pools.cumulativeReactionPercent = [data.priceReaction.cumulativeReactionPercent];
  }

  if (data.priorReportReaction) {
    pools.priorReportDayReactionPercent = [data.priorReportReaction.reportDayReactionPercent];
    pools.priorCumulativeReactionPercent = [data.priorReportReaction.cumulativeReactionPercent];
  }

  if (data.revenueSegments) {
    const percents = nonNull(data.revenueSegments.segments.map((s) => s.percentOfTotal));
    if (percents.length > 0) pools.revenueSegmentPercent = percents;
  }

  if (data.signalConfidence !== null) pools.signalConfidence = [data.signalConfidence];
  if (data.insiderNetSentiment) pools.insiderNetValue = [data.insiderNetSentiment.netValue];

  return pools;
}

// Generous enough to tolerate Claude's own prose rounding without being so
// loose a genuinely different number would slip through — same tolerance
// lib/generatedNews/factPools.ts uses.
export function valueMatchesPool(cited: number, pool: number[]): boolean {
  return pool.some((real) => Math.abs(cited - real) <= Math.max(0.05, Math.abs(real) * 0.01));
}

export const FACT_FIELD_LABELS: Record<string, string> = {
  analystRating: "the analyst consensus rating (1-5 scale)",
  strongBuyCount: "the Strong Buy analyst count",
  buyCount: "the Buy analyst count",
  holdCount: "the Hold analyst count",
  sellCount: "the Sell analyst count",
  strongSellCount: "the Strong Sell analyst count",
  totalAnalysts: "the total number of analysts",
  priceTargetLow: "the low end of the analyst price target range",
  priceTargetAverage: "the average analyst price target",
  priceTargetHigh: "the high end of the analyst price target range",
  priceTargetImpliedChange: "the % change the average price target implies from the current price",
  currentPrice: "the current/latest stock price",
  reportedEps: "this quarter's actual reported EPS",
  estimatedEps: "this quarter's estimated EPS",
  epsSurprisePercent: "this quarter's EPS surprise percentage",
  beatStreakBeats: "how many of the recent quarters beat estimates",
  beatStreakTotal: "how many recent quarters were checked for the beat/miss streak",
  reportDayReactionPercent: "the stock's price move on the report day itself",
  cumulativeReactionPercent: "the stock's cumulative price move since the report",
  priorReportDayReactionPercent: "the prior quarter's report-day price move",
  priorCumulativeReactionPercent: "the prior quarter's cumulative price move since that report",
  revenueSegmentPercent: "a revenue segment's percent of total fiscal-year revenue",
  signalConfidence: "Noble Signals' own confidence score (0-100) for this ticker",
  insiderNetValue: "the net dollar value of recent insider transactions",
};
