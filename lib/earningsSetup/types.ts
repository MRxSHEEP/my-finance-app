// Shared shapes for Earnings Setup Analysis (lib/earningsSetup/*,
// app/api/earnings-setup/route.ts). EarningsSetupDataSnapshot is the exact
// shape stored verbatim in EarningsSetupAnalysis.dataSnapshot — documented
// here rather than enforced at the DB layer, same convention as this
// app's other Json fields (TradeSignal.dataSnapshot, GeneratedNewsArticle.dataSnapshot).

export interface AnalystConsensusSnapshot {
  rating: number;
  ratingLabel: string;
  strongBuy: number;
  buy: number;
  hold: number;
  sell: number;
  strongSell: number;
  totalAnalysts: number;
  period: string | null;
}

export interface PriceTargetSnapshot {
  low: number;
  average: number;
  high: number;
  // Vs. currentPrice, computed from `average` — negative means the
  // average target implies downside from here, not upside.
  impliedChangePercent: number;
}

// A real analyst rating-grade action (not a literal price-target dollar
// revision — see lib/fmp.ts's FmpGrade comment for why), always genuinely
// upgrade/downgrade, never "maintain" (filtered out before this snapshot
// is built).
export interface RatingRevisionSnapshot {
  date: string;
  gradingCompany: string;
  previousGrade: string;
  newGrade: string;
  action: "upgrade" | "downgrade";
}

export interface EarningsQuarterSnapshot {
  period: string;
  year: number;
  quarter: number;
  actual: number | null;
  estimate: number | null;
  surprisePercent: number | null;
}

export interface PriceReactionSnapshot {
  reportDate: string;
  preReportClose: number;
  reportDayClose: number;
  reportDayReactionPercent: number;
  latestClose: number;
  cumulativeReactionPercent: number;
}

// Always a full FISCAL YEAR mix — quarterly segment data is restricted on
// this app's FMP plan (confirmed live), never tied to the specific quarter
// this analysis is otherwise about. Callers must label it by fiscalYear,
// never as belonging to the report itself.
export interface RevenueSegmentSnapshot {
  fiscalYear: number;
  segments: Array<{ name: string; revenue: number; percentOfTotal: number }>;
}

// A genuine, real-data-backed tension between two independently-computed
// signals — never inferred/guessed, only ever recorded when both sides of
// the comparison are themselves real fetched/stored values. `description`
// is plain, factual, pre-written English (not LLM output) describing the
// two real values being compared; the generation step may reference it,
// but the comparison itself is decided in code, not by the model.
export interface DivergenceSnapshot {
  kind: "signal_vs_analyst" | "insider_vs_analyst" | "target_vs_rating";
  description: string;
}

export interface EarningsSetupDataSnapshot {
  ticker: string;
  companyName: string;
  reportDate: string;
  currentPrice: number | null;
  analystConsensus: AnalystConsensusSnapshot | null;
  priceTarget: PriceTargetSnapshot | null;
  recentRevisions: RatingRevisionSnapshot[];
  earningsHistory: EarningsQuarterSnapshot[];
  beatStreak: { beats: number; total: number } | null;
  priceReaction: PriceReactionSnapshot | null;
  priorReportReaction: PriceReactionSnapshot | null;
  revenueSegments: RevenueSegmentSnapshot | null;
  insiderNetSentiment: { label: "Net Buying" | "Net Selling"; netValue: number } | null;
  // From this ticker's own /signals row, if one exists (most tickers
  // won't — /signals only covers its own fixed ~20-name watchlist).
  signalDirection: "bullish" | "neutral" | "bearish" | null;
  signalConfidence: number | null;
  divergences: DivergenceSnapshot[];
}

// Claude's own self-reported numeric citations: fieldName -> the value it
// says it used in the narrative. Only ever contains fields drawn from
// FACT_FIELD_LABELS in lib/earningsSetup/factPools.ts — anything else is
// rejected wholesale by lib/earningsSetup/factCheck.ts.
export type CitedFacts = Record<string, number>;

export interface EarningsSetupDraft {
  narrative: string;
  citedFacts: CitedFacts;
}
