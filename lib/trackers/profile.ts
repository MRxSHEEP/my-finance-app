import { prisma } from "@/lib/prisma";
import { STOCK_CATALOG } from "@/lib/stockCatalog";

const SECTOR_BY_TICKER = new Map(STOCK_CATALOG.map((entry) => [entry.symbol, entry.sector]));

// Mirrors app/api/stock/mini-quotes/route.ts's own MAX_SYMBOLS cap — a
// fund can have up to MAX_POSITIONS_PER_FILING (50, see
// lib/trackers/thirteenF.ts) resolved holdings, more than one mini-quotes
// call allows, so only the top holdings by value get a live price/
// percent-change; the rest still show their filing-date value.
const MAX_LIVE_PRICED_HOLDINGS = 25;

interface MiniQuote {
  symbol: string;
  price: number | null;
  percentChange: number | null;
}

// /api/stock/history's own upstream (TwelveData) can take minutes to
// respond once its daily quota is exhausted — confirmed live: a single
// call hung for 3+ minutes before a 502 (lib/stockHistoryCache.ts has no
// equivalent to the bounded-wait fix already applied to sparkline
// fetching, see lib/sparklineFetch.ts). A tracker profile page has to
// stay responsive regardless, so calls from this module are bounded here
// rather than waiting on a broader fix to that shared cache.
const HISTORY_FETCH_TIMEOUT_MS = 6_000;

async function fetchWithTimeout(url: string | URL, timeoutMs: number): Promise<Response | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    return response.ok ? response : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchLiveQuotes(symbols: string[], origin: string): Promise<Map<string, MiniQuote>> {
  if (symbols.length === 0) return new Map();
  const url = new URL(`/api/stock/mini-quotes?symbols=${symbols.join(",")}&sparkline=false`, origin);
  const response = await fetchWithTimeout(url, HISTORY_FETCH_TIMEOUT_MS);
  if (!response) return new Map();
  const body = await response.json().catch(() => null);
  const quotes: MiniQuote[] = Array.isArray(body?.quotes) ? body.quotes : [];
  return new Map(quotes.map((q) => [q.symbol, q]));
}

// Nearest available close on/before the requested date — SPY doesn't
// necessarily trade on a fund's exact quarter-end filing date (weekends,
// holidays), so this walks back from a wide-enough fetched window. "5Y"
// comfortably covers the 5-quarter backfill's ~15-month span (confirmed
// live: "1Y" cut off before the oldest snapshot, silently dropping the
// benchmark comparison) — safe to request now that fetchWithTimeout
// bounds the wait regardless of how large/slow the underlying range is.
async function fetchPriceNear(ticker: string, date: Date, origin: string): Promise<number | null> {
  const url = new URL(`/api/stock/history?ticker=${ticker}&range=5Y&interval=1day`, origin);
  const response = await fetchWithTimeout(url, HISTORY_FETCH_TIMEOUT_MS);
  if (!response) return null;

  try {
    const body = await response.json().catch(() => null);
    const history: Array<{ date: string; close: number }> = Array.isArray(body?.history) ? body.history : [];
    if (history.length === 0) return null;

    const targetTime = date.getTime();
    let best: { close: number; diff: number } | null = null;
    for (const point of history) {
      const pointTime = new Date(point.date).getTime();
      if (pointTime > targetTime) continue;
      const diff = targetTime - pointTime;
      if (!best || diff < best.diff) best = { close: point.close, diff };
    }
    return best?.close ?? null;
  } catch {
    return null;
  }
}

export interface HoldingOut {
  ticker: string | null;
  issuerName: string | null;
  shares: number | null;
  filingValue: number;
  currentValue: number | null;
  currentPrice: number | null;
  percentChangeToday: number | null;
  percentOfPortfolio: number;
  sector: string | null;
  isEstimate: boolean;
  asOfDate: string;
}

export interface PerformanceOut {
  available: boolean;
  reason?: string;
  startDate?: string;
  endDate?: string;
  entityReturnPercent?: number;
  benchmarkReturnPercent?: number;
  // Raw quarter-end value series (real 13F snapshots) for the chart —
  // indexed to 100 at the first point so it plots as a return line rather
  // than a raw dollar-value scale dominated by the fund's absolute size.
  series?: Array<{ date: string; indexedValue: number }>;
  dividendsExcluded: true;
  methodologyNote: string;
}

export interface TrackerProfile {
  entity: {
    id: string;
    slug: string;
    type: string;
    name: string;
    title: string | null;
    photoUrl: string | null;
    secCik: string | null;
  };
  latestDisclosureDate: string | null;
  portfolioValue: { filingValue: number; currentValue: number | null; isEstimate: boolean };
  holdings: HoldingOut[];
  unresolvedHoldingsCount: number;
  sectorAllocation: Array<{ sector: string; value: number }>;
  topWinners: HoldingOut[];
  topLosers: HoldingOut[];
  recentTransactions: unknown[];
  allTransactions: unknown[];
  performance: PerformanceOut;
}

export async function buildTrackerProfile(slug: string, origin: string): Promise<TrackerProfile | null> {
  const entity = await prisma.trackedEntity.findUnique({ where: { slug } });
  if (!entity) return null;

  const [holdingRows, transactions, snapshots] = await Promise.all([
    prisma.trackerHolding.findMany({ where: { trackedEntityId: entity.id }, orderBy: { estimatedValue: "desc" } }),
    prisma.trackerTransaction.findMany({
      where: { trackedEntityId: entity.id },
      orderBy: [{ reportedDate: "desc" }, { createdAt: "desc" }],
    }),
    prisma.trackerPerformanceSnapshot.findMany({ where: { trackedEntityId: entity.id }, orderBy: { asOfDate: "asc" } }),
  ]);

  const resolvedHoldings = holdingRows.filter((h) => h.ticker);
  const unresolvedHoldingsCount = holdingRows.length - resolvedHoldings.length;

  const priceableTickers = resolvedHoldings
    .slice(0, MAX_LIVE_PRICED_HOLDINGS)
    .map((h) => h.ticker as string);
  const liveQuotes = await fetchLiveQuotes(priceableTickers, origin);

  const totalFilingValue = holdingRows.reduce((sum, h) => sum + (h.estimatedValue ?? 0), 0);

  const holdings: HoldingOut[] = resolvedHoldings.map((h) => {
    const quote = liveQuotes.get(h.ticker as string);
    const currentValue = quote?.price != null && h.shares != null ? h.shares * quote.price : null;
    return {
      ticker: h.ticker,
      issuerName: h.issuerName,
      shares: h.shares,
      filingValue: h.estimatedValue ?? 0,
      currentValue,
      currentPrice: quote?.price ?? null,
      percentChangeToday: quote?.percentChange ?? null,
      percentOfPortfolio: totalFilingValue > 0 ? ((h.estimatedValue ?? 0) / totalFilingValue) * 100 : 0,
      sector: h.ticker ? (SECTOR_BY_TICKER.get(h.ticker) ?? null) : null,
      isEstimate: h.isEstimate,
      asOfDate: h.asOfDate.toISOString(),
    };
  });

  const sectorTotals = new Map<string, number>();
  for (const holding of holdings) {
    const sector = holding.sector ?? "Other / Unclassified";
    sectorTotals.set(sector, (sectorTotals.get(sector) ?? 0) + holding.filingValue);
  }
  const sectorAllocation = Array.from(sectorTotals, ([sector, value]) => ({ sector, value })).sort(
    (a, b) => b.value - a.value
  );

  const withDailyChange = holdings.filter((h) => h.percentChangeToday != null);
  const topWinners = [...withDailyChange].sort((a, b) => b.percentChangeToday! - a.percentChangeToday!).slice(0, 5);
  const topLosers = [...withDailyChange].sort((a, b) => a.percentChangeToday! - b.percentChangeToday!).slice(0, 5);

  const latestDisclosureDate = transactions.reduce<Date | null>((latest, tx) => {
    const candidate = tx.disclosureDate ?? tx.reportedDate;
    if (!candidate) return latest;
    return !latest || candidate > latest ? candidate : latest;
  }, null);

  let performance: PerformanceOut;
  if (snapshots.length >= 2) {
    const first = snapshots[0];
    const last = snapshots[snapshots.length - 1];
    const entityReturnPercent = ((last.totalValue - first.totalValue) / first.totalValue) * 100;
    const [startPrice, endPrice] = await Promise.all([
      fetchPriceNear("SPY", first.asOfDate, origin),
      fetchPriceNear("SPY", last.asOfDate, origin),
    ]);
    const benchmarkReturnPercent =
      startPrice != null && endPrice != null ? ((endPrice - startPrice) / startPrice) * 100 : undefined;

    performance = {
      available: true,
      startDate: first.asOfDate.toISOString(),
      endDate: last.asOfDate.toISOString(),
      entityReturnPercent,
      benchmarkReturnPercent,
      series: snapshots.map((s) => ({
        date: s.asOfDate.toISOString(),
        indexedValue: (s.totalValue / first.totalValue) * 100,
      })),
      dividendsExcluded: true,
      methodologyNote:
        "Estimated from real 13F quarter-end snapshots: total reported holdings value at each filing, marked to market between filings. This look-through approximation can't see trades made and reversed within a single quarter, and excludes dividends.",
    };
  } else {
    performance = {
      available: false,
      reason:
        entity.type === "hedge_fund" || entity.type === "investor"
          ? "Not enough quarterly 13F filings ingested yet to compute a return."
          : "This tracker's return isn't computed from a range/estimate-only feed — insufficient accumulated buy/sell data yet.",
      dividendsExcluded: true,
      methodologyNote: "",
    };
  }

  return {
    entity: {
      id: entity.id,
      slug: entity.slug,
      type: entity.type,
      name: entity.name,
      title: entity.title,
      photoUrl: entity.photoUrl,
      secCik: entity.secCik,
    },
    latestDisclosureDate: latestDisclosureDate?.toISOString() ?? null,
    portfolioValue: {
      filingValue: totalFilingValue,
      currentValue: holdings.every((h) => h.currentValue != null)
        ? holdings.reduce((sum, h) => sum + (h.currentValue ?? 0), 0)
        : null,
      isEstimate: entity.type === "congress" || entity.type === "insider",
    },
    holdings,
    unresolvedHoldingsCount,
    sectorAllocation,
    topWinners,
    topLosers,
    recentTransactions: transactions.slice(0, 10),
    allTransactions: transactions,
    performance,
  };
}
