// Shared client-side logo cache for stock tickers — used by the Stock
// Catalog rows and the Stocks header background's ticker/logo pairing, so
// the two never fetch the same ticker's logo twice. The logo comes from
// app/api/stock/logos/route.ts, a purpose-built batch endpoint (Finnhub's
// company-profile CDN URL) — this module adds caching/dedup AND batching
// on top, not a new source.
//
// Batching matters here specifically: a Stock Catalog page mounts one
// <StockLogo> per row (up to 20 at once), and each independently calling
// fetchStockLogo on mount used to mean 20 separate HTTP round trips to our
// own backend for one page load (confirmed live, alongside the matching
// server-side N Finnhub calls that used to back each of those before the
// batch endpoint existed). Every call arriving within BATCH_WINDOW_MS of
// each other is now collected and sent as one request instead — React
// commits all 20 <StockLogo> mounts in the same pass, so their effects
// fire within microtasks of each other, comfortably inside that window.
//
// A plain module-level Map (not React state) so the cache survives
// unmount/remount of whichever component asked first — e.g. the Stocks
// header fetches AAPL's logo, then the catalog renders an AAPL row later
// in the same session and gets an instant cache hit instead of refetching.
const logoCache = new Map<string, string | null>();
const inFlight = new Map<string, Promise<string | null>>();

// How long to wait for more requests to pile onto the same batch before
// sending it — short enough that no individual row's logo is delayed in
// any way a user would notice, long enough to reliably catch an entire
// page's worth of near-simultaneous mounts.
const BATCH_WINDOW_MS = 20;

let pendingTickers = new Set<string>();
let pendingResolvers = new Map<string, Array<(logo: string | null) => void>>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleFlush() {
  if (flushTimer !== null) return;

  flushTimer = setTimeout(async () => {
    flushTimer = null;
    const tickers = [...pendingTickers];
    const resolvers = pendingResolvers;
    pendingTickers = new Set();
    pendingResolvers = new Map();

    if (tickers.length === 0) return;

    let logos: Record<string, string | null> = {};
    try {
      const response = await fetch(`/api/stock/logos?tickers=${encodeURIComponent(tickers.join(","))}`);
      const body = response.ok ? await response.json().catch(() => null) : null;
      logos = body?.logos ?? {};
    } catch {
      // Every ticker in this batch resolves to null below — same
      // graceful-degrade behavior the old per-ticker version had on a
      // failed fetch, just applied across the whole batch at once.
    }

    for (const ticker of tickers) {
      const logo = logos[ticker] ?? null;
      logoCache.set(ticker, logo);
      inFlight.delete(ticker);
      const callbacks = resolvers.get(ticker) ?? [];
      callbacks.forEach((resolve) => resolve(logo));
    }
  }, BATCH_WINDOW_MS);
}

// undefined = never requested, null = requested and confirmed to have no
// logo, string = the logo URL. Lets a caller distinguish "haven't asked
// yet" from "asked, and there genuinely isn't one" without an extra flag.
export function getCachedStockLogo(symbol: string): string | null | undefined {
  return logoCache.get(symbol);
}

export function fetchStockLogo(symbol: string): Promise<string | null> {
  if (logoCache.has(symbol)) return Promise.resolve(logoCache.get(symbol) ?? null);

  const existing = inFlight.get(symbol);
  if (existing) return existing;

  const promise = new Promise<string | null>((resolve) => {
    const callbacks = pendingResolvers.get(symbol) ?? [];
    callbacks.push(resolve);
    pendingResolvers.set(symbol, callbacks);
    pendingTickers.add(symbol);
  });

  inFlight.set(symbol, promise);
  scheduleFlush();
  return promise;
}
