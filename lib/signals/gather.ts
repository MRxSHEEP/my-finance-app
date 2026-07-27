import { fetchRecentDailyCloses } from "@/lib/stockHistoryCache";
import { dedupeAndSortArticles, fetchAndCleanMarketaux, filterRecentArticles, toMarketauxDate } from "@/lib/newsApi";
import { getNotableHoldersForTicker } from "@/lib/trackers/byTicker";
import { computeTechnicals } from "@/lib/signals/technicals";
import type { EarningsQuarterSnapshot, SignalDataSnapshot, TrackerActivitySnapshot } from "@/lib/signals/types";

const PRICE_HISTORY_DAYS = 210; // comfortably covers a 200-day SMA plus RSI's own lookback
const NEWS_WINDOW_MS = 7 * 24 * 60 * 60_000;
const NEWS_HEADLINE_COUNT = 5;
const MAX_TRACKER_ACTIVITY_PER_CATEGORY = 5;
const RECENT_EARNINGS_QUARTERS = 4;

// Minimal shapes this module actually reads from each internal route's
// response — not the routes' full response types, which carry fields
// (logo, exchange, stale, etc.) this feature has no use for.
interface OverviewResponse {
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

interface PriceTargetResponse {
  available: boolean;
  high: number | null;
  low: number | null;
  average: number | null;
}

interface EarningsResponse {
  nextEarningsDate: string | null;
  quarters: EarningsQuarterSnapshot[];
}

// Composes existing internal routes via absolute-URL fetch rather than
// duplicating their upstream-provider logic — same convention
// app/api/daily-briefing/route.ts already uses for its own mini-quotes
// calls. Never throws: any failure (network, non-2xx, malformed body)
// resolves to null so a single ticker's missing data point doesn't take
// down the whole gather.
async function fetchInternalJson<T>(path: string, origin: string): Promise<T | null> {
  try {
    const response = await fetch(new URL(path, origin));
    if (!response.ok) return null;
    return (await response.json().catch(() => null)) as T | null;
  } catch {
    return null;
  }
}

// Same fetch/dedupe/clean pipeline every other news route in this app is
// built on (lib/newsApi.ts), just scoped to one ticker's own symbol
// instead of the broad market-wide list app/api/news/route.ts and
// Market Digest's NewsDigestSection use — genuine per-company headlines,
// not a slice of the general feed.
async function gatherNews(ticker: string): Promise<SignalDataSnapshot["news"]> {
  const marketauxKey = process.env.MARKETAUX_API_KEY;
  const fromIso = toMarketauxDate(new Date(Date.now() - NEWS_WINDOW_MS));

  const result = await fetchAndCleanMarketaux(marketauxKey, {
    symbols: ticker,
    must_have_entities: "true",
    filter_entities: "true",
    limit: "10",
    published_after: fromIso,
  });

  const recent = filterRecentArticles(dedupeAndSortArticles(result.articles), NEWS_WINDOW_MS);
  return recent.slice(0, NEWS_HEADLINE_COUNT).map((article) => ({
    title: article.title,
    source: article.source,
    publishedAt: article.publishedAt,
  }));
}

function toActivitySnapshot(entries: Array<{
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
}>): TrackerActivitySnapshot[] {
  return entries.slice(0, MAX_TRACKER_ACTIVITY_PER_CATEGORY).map((entry) => ({
    entityName: entry.entityName,
    entityType: entry.entityType,
    transactionType: entry.transactionType,
    reportedDate: entry.reportedDate,
    disclosureDate: entry.disclosureDate,
    reportingPersonName: entry.reportingPersonName,
    shares: entry.shares,
    exactValue: entry.exactValue,
    amountLow: entry.amountLow,
    amountHigh: entry.amountHigh,
  }));
}

// Gathers every data category for one ticker, in parallel, from data
// already ingested/available elsewhere in this app — no new upstream
// provider integration. Every category degrades independently (null or
// an empty array) rather than failing the whole gather, so one missing
// data point never blocks generating a signal from the rest.
export async function gatherTickerData(ticker: string, origin: string): Promise<SignalDataSnapshot> {
  const [bars, overview, priceTarget, earnings, news, holders] = await Promise.all([
    fetchRecentDailyCloses(ticker, PRICE_HISTORY_DAYS),
    fetchInternalJson<OverviewResponse>(`/api/stock/overview?ticker=${encodeURIComponent(ticker)}`, origin),
    fetchInternalJson<PriceTargetResponse>(`/api/stock/price-target?ticker=${encodeURIComponent(ticker)}`, origin),
    fetchInternalJson<EarningsResponse>(`/api/stock/earnings?ticker=${encodeURIComponent(ticker)}`, origin),
    gatherNews(ticker),
    getNotableHoldersForTicker(ticker),
  ]);

  const technical = computeTechnicals(bars);

  const analystRating =
    overview && typeof overview.rating === "number"
      ? { rating: overview.rating, ratingLabel: overview.ratingLabel, recommendationBreakdown: overview.recommendationBreakdown }
      : null;

  // Only ever resolves for a subset of tickers on this app's TwelveData
  // tier (confirmed live: effectively AAPL only) — omitted, not faked,
  // for every ticker where it comes back unavailable.
  const priceTargetSnapshot =
    priceTarget?.available && typeof priceTarget.high === "number" && typeof priceTarget.low === "number" && typeof priceTarget.average === "number"
      ? { high: priceTarget.high, low: priceTarget.low, average: priceTarget.average, isEstimate: false }
      : null;

  const earningsSnapshot = earnings
    ? { nextEarningsDate: earnings.nextEarningsDate, recentQuarters: earnings.quarters.slice(-RECENT_EARNINGS_QUARTERS) }
    : null;

  return {
    technical,
    analystRating,
    priceTarget: priceTargetSnapshot,
    earnings: earningsSnapshot,
    news,
    insiderActivity: toActivitySnapshot(holders.recentActivity.filter((a) => a.entityType === "insider")),
    congressActivity: toActivitySnapshot(holders.recentActivity.filter((a) => a.entityType === "congress")),
  };
}
