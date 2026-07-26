import { withCache } from "@/lib/newsCache";

// Mirrors lib/sparklineFetch.ts's exact resilience pattern, applied to
// Finnhub's /quote endpoint instead of TwelveData's time_series — both
// providers' free tiers can run out of daily/rate-limited quota entirely
// (confirmed live: Finnhub returning 429 across every quote call at once),
// and without a stale fallback every quote/mini-quote on the Stocks page
// goes blank ("—"/empty chart) for the length of an outage instead of
// keeping the last real price on screen.
export interface FinnhubQuote {
  price: number;
  change: number;
  percentChange: number;
  open: number;
  high: number;
  low: number;
  previousClose: number;
  timestamp: string | null;
}

export interface QuoteResult {
  quote: FinnhubQuote | null;
  stale: boolean;
  staleFetchedAt: number | null;
}

const QUOTE_CACHE_TTL_MS = 45_000;
// Mirrors sparklineFetch.ts's own backoff — keeps a sustained outage/quota
// exhaustion answering instantly from the stale/null fallback instead of
// every request paying for its own failed round trip to Finnhub.
const FAILURE_BACKOFF_MS = 60_000;

interface StaleEntry {
  quote: FinnhubQuote;
  fetchedAt: number;
}
// Process-lifetime, no TTL — same reasoning as sparklineFetch.ts's own
// staleCache: this is a "last known good" record, not a freshness cache.
const staleCache = new Map<string, StaleEntry>();
const lastFailureAt = new Map<string, number>();

// Throws (never returns a null/sentinel) on any failure so withCache's
// fetcher never caches a failed attempt as if it were a real quote — the
// exact bug this module is fixing (the previous inline fetchers in
// app/api/stock/route.ts and app/api/stock/mini-quotes/route.ts each
// caught their own errors and returned null, silently caching that null
// for the full TTL even after Finnhub recovered).
async function fetchOne(symbol: string, apiKey: string): Promise<FinnhubQuote> {
  const response = await fetch(`https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${apiKey}`);

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error("Finnhub API rejected the request (invalid or unauthorized API key)");
    }
    if (response.status === 429) {
      throw new Error("Finnhub API rate limit exceeded");
    }
    throw new Error(`Finnhub API error (${response.status})`);
  }

  const data = await response.json().catch(() => null);
  // Finnhub returns HTTP 200 with all-zero fields for unknown symbols
  // rather than an error status.
  const hasData = data && (data.c !== 0 || data.h !== 0 || data.l !== 0 || data.o !== 0 || data.pc !== 0);
  if (!hasData) throw new Error(`No data found for ticker "${symbol}"`);

  const percentChange = typeof data.dp === "number" ? data.dp : ((data.c - data.o) / data.o) * 100;
  const change = typeof data.d === "number" ? data.d : data.c - data.o;

  return {
    price: data.c,
    change,
    percentChange,
    open: data.o,
    high: data.h,
    low: data.l,
    previousClose: data.pc,
    timestamp: data.t ? new Date(data.t * 1000).toISOString() : null,
  };
}

function staleOrNullResult(symbol: string): QuoteResult {
  const stale = staleCache.get(symbol);
  return stale
    ? { quote: stale.quote, stale: true, staleFetchedAt: stale.fetchedAt }
    : { quote: null, stale: false, staleFetchedAt: null };
}

export async function fetchFinnhubQuote(symbol: string, apiKey: string): Promise<QuoteResult> {
  const failedAt = lastFailureAt.get(symbol);
  if (failedAt !== undefined && Date.now() - failedAt < FAILURE_BACKOFF_MS) {
    return staleOrNullResult(symbol);
  }

  try {
    const quote = await withCache(`finnhub-quote:${symbol}`, QUOTE_CACHE_TTL_MS, () => fetchOne(symbol, apiKey));
    staleCache.set(symbol, { quote, fetchedAt: Date.now() });
    lastFailureAt.delete(symbol);
    return { quote, stale: false, staleFetchedAt: null };
  } catch (err) {
    console.error(
      `[finnhub-quote] ${symbol}: fetch failed, falling back to stale cache if available: ${
        err instanceof Error ? err.message : String(err)
      }`
    );
    lastFailureAt.set(symbol, Date.now());
    return staleOrNullResult(symbol);
  }
}
