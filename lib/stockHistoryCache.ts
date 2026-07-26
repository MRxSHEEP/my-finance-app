import { withCache } from "@/lib/newsCache";
import {
  isTwelveDataDailyExhaustionMessage,
  markTwelveDataDailyExhausted,
  throttledTwelveDataCall,
} from "@/lib/twelveDataThrottle";

export interface RawBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

// Intraday bars go stale within minutes; daily bars barely move until the
// next session closes — TTLs sized accordingly so a cache hit is the
// common case (this is the main lever against re-hitting TwelveData's
// tight free-tier rate limit on every chart open/range switch).
const INTRADAY_CACHE_TTL_MS = 60_000;
const DAILY_CACHE_TTL_MS = 15 * 60_000;

function historyCacheTtl(interval: string): number {
  return interval === "1day" ? DAILY_CACHE_TTL_MS : INTRADAY_CACHE_TTL_MS;
}

interface RawTwelveDataValue {
  datetime: string;
  open: string;
  high: string;
  low: string;
  close: string;
  volume?: string;
}

// Throttled + TTL-cached + parsed single TwelveData time_series call.
// Throws (rather than returning a sentinel) on any failure — a caller
// composing the fallback chain below just try/catches each step, and
// critically, withCache's fetcher throwing propagates straight through
// without ever reaching its `cache.set` line, so a failed attempt never
// gets cached as if it were a real result.
async function fetchTwelveDataBars(cacheKey: string, url: string, interval: string, ticker: string): Promise<RawBar[]> {
  return withCache(cacheKey, historyCacheTtl(interval), () =>
    throttledTwelveDataCall(async () => {
      const response = await fetch(url);
      const body = await response.json().catch(() => null);

      if (!response.ok || body?.status === "error") {
        const message = body?.message ?? `TwelveData request failed (${response.status})`;
        if (isTwelveDataDailyExhaustionMessage(message)) markTwelveDataDailyExhausted();
        throw new Error(message);
      }
      if (!Array.isArray(body?.values) || body.values.length === 0) {
        throw new Error("TwelveData returned no data");
      }

      return (body.values as RawTwelveDataValue[])
        .map((value) => ({
          date: value.datetime,
          open: Number(value.open),
          high: Number(value.high),
          low: Number(value.low),
          close: Number(value.close),
          volume: value.volume !== undefined ? Number(value.volume) : undefined,
        }))
        .reverse();
    }, `history:${ticker}:${interval}`)
  );
}

// A small, direct (non-fallback-chain) helper for callers that just need
// the N most recent daily closes — e.g. computing the regular-session
// close for an extended-hours quote (see app/api/stock/route.ts) — reusing
// the same throttle/cache as the main chart rather than hitting TwelveData
// unthrottled.
export async function fetchRecentDailyCloses(ticker: string, count: number): Promise<RawBar[]> {
  const apiKey = process.env.TWELVEDATA_API_KEY;
  if (!apiKey) return [];

  const url = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(
    ticker
  )}&interval=1day&outputsize=${count}&apikey=${apiKey}`;

  try {
    return await fetchTwelveDataBars(`stock-history:${url}`, url, "1day", ticker);
  } catch {
    return [];
  }
}

interface StaleEntry {
  history: RawBar[];
  interval: string;
  fetchedAt: number;
}

// A separate, TTL-less cache of "last known good" history per (ticker,
// range) — updated on every successful fetch, kept around for the whole
// process lifetime (not just the short TTL above) so a returning user
// still sees a recent chart instead of a blank/error card when TwelveData
// itself is down or rate-limited and even the daily-interval retry fails.
const staleCache = new Map<string, StaleEntry>();

function staleKey(ticker: string, range: string): string {
  return `${ticker}:${range}`;
}

// Mirrors lib/sparklineFetch.ts's own FAILURE_BACKOFF_MS/lastFailureAt
// pattern, ported over here — this module never had it, which meant every
// single request for a (ticker, range) that had JUST failed re-attempted
// both the primary AND daily-fallback fetch again from scratch (2 more
// guaranteed-to-fail TwelveData calls) instead of answering instantly from
// the stale/error fallback like sparklines already do. Confirmed live as
// one of the two gaps behind the account's daily "used" count climbing
// well past its cap — the other being the shared circuit breaker now in
// lib/twelveDataThrottle.ts, which this backoff complements rather than
// duplicates: the breaker stops *every* consumer at once on a confirmed
// daily exhaustion, while this backoff also covers narrower, per-ticker
// failures (a single symbol's request shape hitting trouble) that
// wouldn't trip the account-wide breaker at all.
const HISTORY_FAILURE_BACKOFF_MS = 60_000;
const lastFailureAt = new Map<string, number>();

export interface HistoryFetchParams {
  ticker: string;
  // A stable label for this request shape — an enum range ("1D", "1M", …)
  // for normal chart loads, or a synthetic key (e.g. `custom:${start}:${end}`)
  // for explicit date-range requests — used only to key the stale-fallback
  // cache above, not sent upstream.
  range: string;
  primaryUrl: string;
  primaryInterval: string;
  // The equivalent request at daily granularity, or null when the primary
  // request already IS daily (no coarser fallback exists) or a fallback
  // doesn't make sense for this call shape.
  dailyUrl: string | null;
}

export interface HistoryFetchResult {
  history: RawBar[];
  interval: string;
  stale: boolean;
  staleFetchedAt: number | null;
  // True when the response is at a coarser interval than what was
  // requested (either freshly, via the daily retry, or from a stale
  // cache entry that itself was daily) — lets the UI say "showing daily
  // data" instead of silently mislabeling a daily chart as intraday.
  fallbackApplied: boolean;
}

function staleOrErrorResult(
  key: string,
  primaryInterval: string
): HistoryFetchResult | { error: string } {
  const stale = staleCache.get(key);
  if (stale) {
    return {
      history: stale.history,
      interval: stale.interval,
      stale: true,
      staleFetchedAt: stale.fetchedAt,
      fallbackApplied: stale.interval !== primaryInterval,
    };
  }

  // Never surface the provider's own error text (rate-limit messages,
  // plan-restriction wording, etc.) — one fixed, friendly message
  // regardless of the underlying cause.
  return {
    error: primaryInterval === "1day" ? "Chart data temporarily unavailable" : "Intraday chart temporarily unavailable",
  };
}

export async function fetchHistoryWithFallback(
  params: HistoryFetchParams
): Promise<HistoryFetchResult | { error: string }> {
  const { ticker, range, primaryUrl, primaryInterval, dailyUrl } = params;
  const key = staleKey(ticker, range);

  const failedAt = lastFailureAt.get(key);
  if (failedAt !== undefined && Date.now() - failedAt < HISTORY_FAILURE_BACKOFF_MS) {
    return staleOrErrorResult(key, primaryInterval);
  }

  try {
    const history = await fetchTwelveDataBars(`stock-history:${primaryUrl}`, primaryUrl, primaryInterval, ticker);
    staleCache.set(key, { history, interval: primaryInterval, fetchedAt: Date.now() });
    lastFailureAt.delete(key);
    return { history, interval: primaryInterval, stale: false, staleFetchedAt: null, fallbackApplied: false };
  } catch (primaryErr) {
    console.error(
      `[stock-history] ${ticker} primary (${primaryInterval}) fetch failed: ${
        primaryErr instanceof Error ? primaryErr.message : String(primaryErr)
      }`
    );

    if (dailyUrl) {
      try {
        const history = await fetchTwelveDataBars(`stock-history:${dailyUrl}`, dailyUrl, "1day", ticker);
        staleCache.set(key, { history, interval: "1day", fetchedAt: Date.now() });
        lastFailureAt.delete(key);
        return { history, interval: "1day", stale: false, staleFetchedAt: null, fallbackApplied: true };
      } catch (dailyErr) {
        console.error(
          `[stock-history] ${ticker} daily-interval fallback also failed: ${
            dailyErr instanceof Error ? dailyErr.message : String(dailyErr)
          }`
        );
      }
    }

    lastFailureAt.set(key, Date.now());
    return staleOrErrorResult(key, primaryInterval);
  }
}
