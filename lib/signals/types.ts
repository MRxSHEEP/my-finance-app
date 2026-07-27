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
// RecentActivityEntry already uses.
export interface TrackerActivitySnapshot {
  entityName: string;
  entityType: string;
  transactionType: string;
  reportedDate: string | null;
  disclosureDate: string | null;
  reportingPersonName: string | null;
}

export interface SignalDataSnapshot {
  technical: TechnicalSnapshot;
  analystRating: AnalystRatingSnapshot | null;
  // Only ever populated for tickers where TwelveData's price-target
  // endpoint actually resolves on this app's tier (confirmed live:
  // effectively AAPL only) — null elsewhere, never faked.
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
}
