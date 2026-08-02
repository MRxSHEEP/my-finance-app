import { withCache } from "@/lib/newsCache";
import {
  isTwelveDataDailyExhaustionMessage,
  markTwelveDataDailyExhausted,
  throttledTwelveDataCall,
} from "@/lib/twelveDataThrottle";

export interface SparklinePoint {
  time: number;
  value: number;
}

// Sparklines are read-mostly and don't need same-minute freshness, so they
// get a much longer cache than a live quote — this is the main lever
// against TwelveData's tight free-tier rate limit (8 calls/minute,
// confirmed live elsewhere in this app), since it means the throttle
// below is only actually exercised once per ticker per this window,
// not once per page view.
const SPARKLINE_CACHE_TTL_MS = 25 * 60_000;
const OUTPUT_SIZE = 22; // ~1 trading month of daily closes

// A separate, TTL-less "last known good" cache per ticker, kept for the
// whole process lifetime — mirrors lib/stockHistoryCache.ts's own
// stale-fallback cache, built for the exact same TwelveData failure mode
// (confirmed live: the account's daily credit quota, not just the
// per-minute rate limit, can run out entirely — every call fails until it
// resets). Without this, a symbol that's never been fetched successfully
// during an outage/quota exhaustion has nothing to fall back to and
// correctly shows "no chart data"; a symbol that WAS fetched successfully
// earlier keeps showing that (now-stale) sparkline instead of going blank
// the moment its 25-minute cache entry expires.
interface StaleEntry {
  points: SparklinePoint[];
  fetchedAt: number;
}
const staleCache = new Map<string, StaleEntry>();

// How long to hold off retrying a ticker after it fails, before falling
// through to the network again. Without this, a sustained outage/quota
// exhaustion (not just a transient blip) turns every single request for
// an unfetched ticker into a full trip through the shared, serialized
// TwelveData throttle (~7.6s, worse once its 8/minute cap is hit) — for a
// full page of 20 never-cached catalog rows that's minutes per request,
// confirmed live (a 3-symbol batch took 61s once the day's quota was
// exhausted). A short backoff keeps failed tickers answering instantly
// from the stale/null fallback instead, while still trying again on its
// own well within a page reload once TwelveData recovers.
const FAILURE_BACKOFF_MS = 60_000;
const lastFailureAt = new Map<string, number>();

export interface SparklineResult {
  points: SparklinePoint[] | null;
  stale: boolean;
  staleFetchedAt: number | null;
}

// Throws (rather than returning null) on any failure — critically, this
// means withCache's fetcher never reaches its cache.set line on a failed
// attempt, so a rate-limit/outage failure is never cached as if it were a
// real "no sparkline data" answer for the next 25 minutes. The previous
// version of this function caught its own errors and returned null, which
// silently became a cached negative result — the actual root cause of
// most catalog rows losing their sparkline for a full 25-minute stretch
// any time TwelveData's quota ran out.
async function fetchOne(ticker: string): Promise<SparklinePoint[]> {
  const apiKey = process.env.TWELVEDATA_API_KEY;
  if (!apiKey) throw new Error("Server is missing TWELVEDATA_API_KEY configuration");

  return throttledTwelveDataCall(async () => {
    const response = await fetch(
      `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(
        ticker
      )}&interval=1day&outputsize=${OUTPUT_SIZE}&apikey=${apiKey}`
    );
    const body = await response.json().catch(() => null);

    if (!response.ok || body?.status === "error") {
      const message = body?.message ?? `TwelveData request failed (${response.status})`;

      // Diagnostic instrumentation only — does not change what's thrown or
      // how the daily-exhaustion breaker trips below. Logs the actual
      // header set rather than guessing names, and separates "non-2xx
      // status" from "200 with an error payload" (isHttpError/isPayloadError
      // can currently only be inferred by re-deriving them from `message`,
      // which collapses both shapes into one string).
      const retryAfter = response.headers.get("retry-after");
      const headers: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        headers[key] = value;
      });
      console.error("[twelvedata-failure]", {
        ticker,
        httpStatus: response.status,
        is429: response.status === 429,
        isHttpError: !response.ok,
        isPayloadError: body?.status === "error",
        retryAfter: retryAfter ?? "(absent)",
        headers,
        message,
      });

      if (isTwelveDataDailyExhaustionMessage(message)) markTwelveDataDailyExhausted();
      throw new Error(message);
    }
    if (!Array.isArray(body?.values) || body.values.length === 0) {
      throw new Error("TwelveData returned no data");
    }

    return (body.values as Array<{ datetime: string; close: string }>)
      .map((value) => ({
        time: Math.floor(new Date(`${value.datetime}T00:00:00Z`).getTime() / 1000),
        value: Number(value.close),
      }))
      .reverse(); // TwelveData returns newest-first; charts read left-to-right
  }, `sparkline:${ticker}`);
}

function staleOrNullResult(ticker: string): SparklineResult {
  const stale = staleCache.get(ticker);
  return stale
    ? { points: stale.points, stale: true, staleFetchedAt: stale.fetchedAt }
    : { points: null, stale: false, staleFetchedAt: null };
}

// Tracks the one in-flight attempt per ticker — without this, the batch
// wait below (a caller giving up after BATCH_WAIT_MS while the real fetch
// keeps running) plus a later retry for that same still-unresolved ticker
// would each start their *own* trip through the shared throttle, doubling
// up on an already-strained queue instead of both just waiting on the one
// attempt already in progress. Confirmed live: without this, requesting
// the same never-cached symbol twice a few seconds apart cost ~4.5s each
// time instead of the second call reusing the first's still-running fetch.
const inFlight = new Map<string, Promise<SparklineResult>>();

async function fetchFresh(ticker: string): Promise<SparklineResult> {
  const failedAt = lastFailureAt.get(ticker);
  if (failedAt !== undefined && Date.now() - failedAt < FAILURE_BACKOFF_MS) {
    return staleOrNullResult(ticker);
  }

  try {
    const points = await withCache(`sparkline:${ticker}`, SPARKLINE_CACHE_TTL_MS, () => fetchOne(ticker));
    staleCache.set(ticker, { points, fetchedAt: Date.now() });
    lastFailureAt.delete(ticker);
    return { points, stale: false, staleFetchedAt: null };
  } catch (err) {
    console.error(
      `[sparkline] ${ticker}: fetch failed, falling back to stale cache if available: ${
        err instanceof Error ? err.message : String(err)
      }`
    );
    lastFailureAt.set(ticker, Date.now());
    return staleOrNullResult(ticker);
  }
}

export function fetchStockSparkline(ticker: string): Promise<SparklineResult> {
  const existing = inFlight.get(ticker);
  if (existing) return existing;

  const promise = fetchFresh(ticker).finally(() => inFlight.delete(ticker));
  inFlight.set(ticker, promise);
  return promise;
}

// How long a single batch request (e.g. one Stock Catalog page of up to
// 20 symbols) will wait on a ticker whose sparkline isn't already cached,
// before answering with whatever's already known (stale or null) for it
// instead. Without this bound, a batch of never-before-fetched tickers
// blocks the *entire* response on the shared throttle's serialized
// ~7.6s-per-symbol pacing — 20 symbols is minutes, easily long enough for
// the client to have already navigated away or for the request to time
// out/504 before it ever arrives (confirmed live: a 5-symbol batch took
// 65s during a quota outage). The underlying fetch for a ticker that times
// out here is NOT cancelled — it keeps running and still populates the
// normal caches above, so the next request for that ticker (a later page
// visit, or the retry StockCatalogSection schedules for exactly this
// case) picks it up already warm instead of paying the full cost again.
const BATCH_WAIT_MS = 4_500;

export async function fetchStockSparklines(tickers: string[]): Promise<Map<string, SparklineResult>> {
  const entries = await Promise.all(
    tickers.map(async (ticker) => {
      const pending = fetchStockSparkline(ticker);
      const result = await Promise.race([
        pending,
        new Promise<SparklineResult>((resolve) => {
          setTimeout(() => resolve(staleOrNullResult(ticker)), BATCH_WAIT_MS);
        }),
      ]);
      return [ticker, result] as const;
    })
  );
  return new Map(entries);
}
