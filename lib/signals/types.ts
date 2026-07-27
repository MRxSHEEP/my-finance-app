// Shared shapes for the AI trade signals feature (app/signals/page.tsx,
// app/api/signals/ingest/route.ts). SignalDataSnapshot is the exact shape
// stored verbatim in TradeSignal.dataSnapshot (see prisma/schema.prisma) —
// documented here rather than enforced at the DB layer, same convention
// as this app's other Json fields (WatchlistItem, DashboardConfig).

export type SignalDirection = "bullish" | "neutral" | "bearish";

export interface TechnicalSnapshot {
  latestClose: number | null;
  sma50: number | null;
  sma200: number | null;
  rsi14: number | null;
  // Recent (10-session) average volume vs. a 60-session baseline, as a
  // percent difference — positive means busier than usual.
  volumeTrendPercent: number | null;
}

export interface AnalystRatingSnapshot {
  rating: number | null;
  ratingLabel: string;
  recommendationBreakdown: {
    period: string | null;
    strongBuy: number;
    buy: number;
    hold: number;
    sell: number;
    strongSell: number;
  } | null;
}

export interface PriceTargetSnapshot {
  high: number;
  low: number;
  average: number;
  // True when this is Claude's own best-effort estimate (no real analyst
  // price target was available for this ticker), false for a real
  // TwelveData-reported target — same isEstimate convention already used
  // throughout this app (TrackerHolding.isEstimate, TrackerTransaction.isEstimate).
  isEstimate: boolean;
}

export interface EarningsQuarterSnapshot {
  period: string;
  year: number;
  quarter: number;
  actual: number | null;
  estimate: number | null;
  surprisePercent: number | null;
}

export interface EarningsSnapshot {
  nextEarningsDate: string | null;
  recentQuarters: EarningsQuarterSnapshot[];
}

export interface NewsHeadlineSnapshot {
  title: string;
  source: string;
  publishedAt: string | null;
}

// Shared shape for both insider (Form 4) and congress (PTR) activity —
// distinguished by entityType, same field names lib/trackers/byTicker.ts's
// RecentActivityEntry already uses. Insider transactions populate
// shares/exactValue (real, precise figures); congress disclosures only
// ever populate amountLow/amountHigh (a value range, never an exact
// figure or share count) — never both, depending on entityType. Carrying
// these lets the page visually differentiate genuinely distinct same-day
// transactions from the same person (e.g. separate 10b5-1 sale tranches),
// rather than every row for one person on one day looking identical.
export interface TrackerActivitySnapshot {
  entityName: string;
  entityType: string;
  transactionType: string;
  reportedDate: string | null;
  disclosureDate: string | null;
  reportingPersonName: string | null;
  shares: number | null;
  exactValue: number | null;
  amountLow: number | null;
  amountHigh: number | null;
}

export interface SignalDataSnapshot {
  technical: TechnicalSnapshot;
  analystRating: AnalystRatingSnapshot | null;
  // Real TwelveData-reported target only resolves for a subset of tickers
  // on this app's tier (confirmed live: effectively AAPL only). When it's
  // null here, app/api/signals/ingest/route.ts fills this slot with
  // Claude's own estimate (GeneratedSignal.estimatedPriceTarget) before
  // storing — so by the time this is persisted, it's either a real target
  // (isEstimate: false) or an AI one (isEstimate: true), never a mix, and
  // still null only when neither was obtainable.
  priceTarget: PriceTargetSnapshot | null;
  earnings: EarningsSnapshot | null;
  news: NewsHeadlineSnapshot[];
  insiderActivity: TrackerActivitySnapshot[];
  congressActivity: TrackerActivitySnapshot[];
}

export interface GeneratedSignal {
  direction: SignalDirection;
  confidence: number;
  rationale: string;
  // Only ever requested/populated when the real price target was
  // unavailable — see buildPrompt's conditional PRICE_TARGET_ESTIMATE
  // instruction in lib/signals/generate.ts.
  estimatedPriceTarget: PriceTargetSnapshot | null;
}
