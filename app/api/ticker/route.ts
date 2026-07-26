import { NextResponse } from "next/server";
import { COMMODITY_NAMES } from "@/lib/commodityNames";
import { fetchStockSparklines } from "@/lib/sparklineFetch";
import { fetchFinnhubQuote as fetchSharedFinnhubQuote } from "@/lib/finnhubQuoteCache";

// This route has no request-dependent branching, which would let Next.js
// treat it as statically optimizable; force it dynamic so every poll
// actually re-runs the (cached) upstream fetch logic below.
export const dynamic = "force-dynamic";

type Provider = "finnhub" | "polygon";

interface AssetDef {
  // The symbol actually sent to the upstream provider.
  symbol: string;
  // Short display name shown in the ticker.
  label: string;
  provider: Provider;
}

interface QuoteResult {
  price: number;
  change: number;
  percentChange: number;
  // True when this is last-known-good data served because the live quote
  // fetch failed (rate limit/quota/outage) rather than a fresh read — see
  // fetchFinnhubQuote/fetchPolygonQuote below.
  stale: boolean;
}

interface TickerItem {
  symbol: string;
  label: string;
  price: number | null;
  change: number | null;
  percentChange: number | null;
  stale: boolean;
}

interface HistoryPoint {
  time: number;
  value: number;
}

interface CommodityItem {
  symbol: string;
  name: string;
  price: number | null;
  change: number | null;
  percentChange: number | null;
  history: HistoryPoint[] | null;
  stale: boolean;
}

// Neither Finnhub's nor Polygon's free tier exposes real index quotes
// (^DJI/^IXIC return "Market data subscription required") or spot
// commodity prices for oil, so those three use free-tier-accessible
// proxies instead: DIA/QQQ track the Dow/Nasdaq, USO tracks WTI crude.
// Gold and silver ARE available on Polygon's free tier as forex pairs
// (XAU/XAG are real ISO 4217 currency codes), so those two go through
// Polygon; everything else goes through Finnhub's /quote endpoint
// (already used elsewhere in this project).
const ASSET_DEFS: AssetDef[] = [
  { symbol: "C:XAUUSD", label: "GOLD", provider: "polygon" },
  { symbol: "USO", label: "OIL", provider: "finnhub" },
  { symbol: "C:XAGUSD", label: "SILVER", provider: "polygon" },
  { symbol: "BINANCE:BTCUSDT", label: "BTC", provider: "finnhub" },
  { symbol: "DIA", label: "DOW", provider: "finnhub" },
  { symbol: "QQQ", label: "NASDAQ", provider: "finnhub" },
  { symbol: "AAPL", label: "AAPL", provider: "finnhub" },
  { symbol: "MSFT", label: "MSFT", provider: "finnhub" },
  { symbol: "GOOGL", label: "GOOGL", provider: "finnhub" },
  { symbol: "AMZN", label: "AMZN", provider: "finnhub" },
  { symbol: "NVDA", label: "NVDA", provider: "finnhub" },
  { symbol: "META", label: "META", provider: "finnhub" },
  { symbol: "TSLA", label: "TSLA", provider: "finnhub" },
];

// Rate budgets (confirmed live against both providers): Finnhub's free
// tier allows 60 calls/minute; Polygon's Basic (free) tier allows only
// 5 calls/minute (a 6th rapid call returns 429 — verified directly).
// The client polls this route every 20s (see TickerBar), but every
// concurrent tab/user hits this same route, so upstream calls must be
// deduped server-side regardless of client poll rate — that's what the
// caches below do, each with a TTL sized to its provider's real budget:
//   Finnhub group (11 symbols): refetched at most every 20s
//     -> 11 * 3/min = 33 calls/min (≈ 47,520/day) — well under 60/min.
//   Polygon group (2 symbols): refetched at most every 60s
//     -> 2 * 1/min = 2 calls/min (≈ 2,880/day) — well under 5/min.
// So the client-visible poll stays fast/uniform at 20s, while the two
// slowest-moving, most rate-constrained symbols (gold/silver) simply
// keep serving their last cached value for up to 60s at a time instead
// of forcing everything down to Polygon's much stricter cadence.
const FINNHUB_TTL_MS = 20_000;
const POLYGON_TTL_MS = 60_000;

function makeGroupFetcher<T extends AssetDef>(
  defs: T[],
  ttlMs: number,
  fetchOne: (def: T) => Promise<QuoteResult | null>
) {
  let cache: { data: Map<string, QuoteResult | null>; expiresAt: number } | null = null;
  let inflight: Promise<Map<string, QuoteResult | null>> | null = null;

  return async function getGroup(): Promise<Map<string, QuoteResult | null>> {
    const now = Date.now();
    if (cache && cache.expiresAt > now) return cache.data;
    // A cache miss with a fetch already in flight (e.g. two concurrent
    // client polls) should share that one fetch rather than each firing
    // their own upstream request storm.
    if (inflight) return inflight;

    inflight = (async () => {
      const entries = await Promise.all(
        defs.map(async (def) => [def.symbol, await fetchOne(def)] as const)
      );
      const data = new Map(entries);
      cache = { data, expiresAt: Date.now() + ttlMs };
      inflight = null;
      return data;
    })();

    return inflight;
  };
}

// Delegates to the same shared, stale-fallback-aware Finnhub quote cache
// already used by /api/stock/mini-quotes (lib/finnhubQuoteCache.ts). This
// route used to have its own separate, weaker implementation here (a plain
// fetch with no stale fallback at all) — confirmed live as the actual bug
// behind Bitcoin/Dow Jones/Nasdaq on the homepage hero going completely
// blank together while Gold (a separate Polygon-sourced group, unaffected)
// kept working: a single transient Finnhub-side rate-limit/outage made the
// *entire* Finnhub-sourced group's cache resolve to nulls for the length
// of its TTL, instead of continuing to show each symbol's last known-good
// price the way every other Finnhub consumer in this app already does.
async function fetchFinnhubQuote(def: AssetDef): Promise<QuoteResult | null> {
  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) return null;

  const result = await fetchSharedFinnhubQuote(def.symbol, apiKey);
  if (!result.quote) return null;

  return {
    price: result.quote.price,
    change: result.quote.change,
    percentChange: result.quote.percentChange,
    stale: result.stale,
  };
}

// Mirrors lib/finnhubQuoteCache.ts's/lib/sparklineFetch.ts's exact stale-
// fallback + failure-backoff pattern. Polygon has no shared cache module
// of its own yet (only gold/silver ever go through it, both fetched only
// here), but the same resilience gap applies: without this, a transient
// Polygon hiccup would mean gold/silver go blank too instead of keeping
// their last real price like the Finnhub-sourced symbols now do above.
interface StalePolygonEntry {
  quote: Omit<QuoteResult, "stale">;
  fetchedAt: number;
}
const polygonStaleCache = new Map<string, StalePolygonEntry>();
const polygonLastFailureAt = new Map<string, number>();
const POLYGON_FAILURE_BACKOFF_MS = 60_000;

function polygonStaleOrNullResult(symbol: string): QuoteResult | null {
  const stale = polygonStaleCache.get(symbol);
  return stale ? { ...stale.quote, stale: true } : null;
}

async function fetchPolygonQuoteFresh(symbol: string, apiKey: string): Promise<Omit<QuoteResult, "stale">> {
  // Polygon's free tier has no real-time snapshot/last-quote access
  // (confirmed live: NOT_AUTHORIZED), so pull the last two daily bars
  // instead and compute change the same way Finnhub's d/dp do
  // (latest close vs. the prior day's close) — a 10-day lookback window
  // comfortably covers weekends/holidays to still find two bars.
  const to = new Date();
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - 10);
  const fromStr = from.toISOString().slice(0, 10);
  const toStr = to.toISOString().slice(0, 10);

  const response = await fetch(
    `https://api.polygon.io/v2/aggs/ticker/${encodeURIComponent(
      symbol
    )}/range/1/day/${fromStr}/${toStr}?adjusted=true&sort=desc&limit=2&apiKey=${apiKey}`
  );
  if (!response.ok) throw new Error(`Polygon API error (${response.status})`);

  const data = await response.json().catch(() => null);
  const bars: Array<{ c: number }> = Array.isArray(data?.results) ? data.results : [];
  if (bars.length === 0) throw new Error(`Polygon returned no bars for "${symbol}"`);

  const [latest, previous] = bars;
  if (!previous) return { price: latest.c, change: 0, percentChange: 0 };

  const change = latest.c - previous.c;
  const percentChange = previous.c !== 0 ? (change / previous.c) * 100 : 0;
  return { price: latest.c, change, percentChange };
}

async function fetchPolygonQuote(def: AssetDef): Promise<QuoteResult | null> {
  const apiKey = process.env.POLYGON_API_KEY;
  if (!apiKey) return null;

  const failedAt = polygonLastFailureAt.get(def.symbol);
  if (failedAt !== undefined && Date.now() - failedAt < POLYGON_FAILURE_BACKOFF_MS) {
    return polygonStaleOrNullResult(def.symbol);
  }

  try {
    const quote = await fetchPolygonQuoteFresh(def.symbol, apiKey);
    polygonStaleCache.set(def.symbol, { quote, fetchedAt: Date.now() });
    polygonLastFailureAt.delete(def.symbol);
    return { ...quote, stale: false };
  } catch (err) {
    console.error(
      `[ticker] ${def.symbol}: Polygon fetch failed, falling back to stale cache if available: ${
        err instanceof Error ? err.message : String(err)
      }`
    );
    polygonLastFailureAt.set(def.symbol, Date.now());
    return polygonStaleOrNullResult(def.symbol);
  }
}

const getFinnhubGroup = makeGroupFetcher(
  ASSET_DEFS.filter((def) => def.provider === "finnhub"),
  FINNHUB_TTL_MS,
  fetchFinnhubQuote
);

const getPolygonGroup = makeGroupFetcher(
  ASSET_DEFS.filter((def) => def.provider === "polygon"),
  POLYGON_TTL_MS,
  fetchPolygonQuote
);

// Additional commodities for the /commodities page, on top of the
// gold/oil/silver already fetched above for the ticker bar. Deliberately
// kept in their own cache group (same fetchFinnhubQuote helper, reused
// rather than duplicated) instead of folding them into ASSET_DEFS/
// getFinnhubGroup above: that group's 11 symbols already run at a 20s
// TTL sized specifically to Finnhub's 60/min free-tier cap (verified
// live), and merging in 6 more would push that group to 51 calls/min —
// uncomfortably close to the cap with no headroom left for the rest of
// the app's own Finnhub usage (stock search/quotes/fundamentals, the
// crypto page's quotes). A separate 30s-TTL group for just these 6 adds
// only 12 calls/min on top, for 45/min combined — same ticker-bar
// cadence as before, comfortably under the cap either way. All are
// liquid, US-listed ETF proxies (confirmed live) — same reasoning as
// USO/DIA/QQQ above, since Finnhub's free tier has no futures/spot
// commodity data.
const EXTRA_COMMODITY_DEFS: AssetDef[] = [
  { symbol: "BNO", label: "BRENT", provider: "finnhub" },
  { symbol: "UNG", label: "NATGAS", provider: "finnhub" },
  { symbol: "CPER", label: "COPPER", provider: "finnhub" },
  { symbol: "CORN", label: "CORN", provider: "finnhub" },
  { symbol: "WEAT", label: "WHEAT", provider: "finnhub" },
  { symbol: "SOYB", label: "SOYBEANS", provider: "finnhub" },
];
const EXTRA_COMMODITY_TTL_MS = 30_000;

const getExtraCommodityGroup = makeGroupFetcher(
  EXTRA_COMMODITY_DEFS,
  EXTRA_COMMODITY_TTL_MS,
  fetchFinnhubQuote
);

// ---------------------------------------------------------------------
// Sparkline history for the /commodities page's price grid.
//
// Gold/silver go through Polygon (same forex-pair aggregates already used
// for their quotes above) via a small backfill cache, same as before.
//
// The seven ETF proxies (USO/BNO/UNG/CPER/CORN/WEAT/SOYB) used to go
// through a bespoke, *unthrottled* TwelveData call in this file — that was
// the actual bug behind their sparklines going permanently blank (empty
// gray boxes, confirmed live) any time the account's shared daily
// TwelveData credit quota ran out: this route's own fetch bypassed
// lib/twelveDataThrottle.ts entirely (every other TwelveData consumer in
// the app — lib/stockHistoryCache.ts, lib/sparklineFetch.ts — goes
// through it), so it never coordinated pacing with the rest of the app's
// calls, and it had no "last known good" fallback, so a single failed
// fetch meant `history: null` forever (or until the next 30-minute
// backfill attempt, which would just fail again during a sustained
// outage). These are plain US-listed ETF tickers — exactly what
// lib/sparklineFetch.ts already fetches for the stock catalog, throttled
// and TTL-cached with a process-lifetime stale fallback and a short
// failure backoff — so they're fetched the same way here instead of
// through a second, weaker implementation.
const GOLD_SILVER_HISTORY_TTL_MS = 30 * 60_000;
const GOLD_SILVER_HISTORY_FETCH_SPACING_MS = 20_000;
const GOLD_SILVER_HISTORY_LOOKBACK_DAYS = 30;

// The seven ETF-proxy commodities now go entirely through
// lib/sparklineFetch.ts's fetchStockSparklines — see the comment above.
export const TWELVEDATA_COMMODITY_SYMBOLS = ["USO", "BNO", "UNG", "CPER", "CORN", "WEAT", "SOYB"];

const commodityHistoryCache = new Map<string, { data: HistoryPoint[]; expiresAt: number }>();
let commodityHistoryBackfillRunning = false;

async function fetchPolygonHistory(symbol: string): Promise<HistoryPoint[] | null> {
  const apiKey = process.env.POLYGON_API_KEY;
  if (!apiKey) return null;

  try {
    const to = new Date();
    const from = new Date(to);
    from.setUTCDate(from.getUTCDate() - GOLD_SILVER_HISTORY_LOOKBACK_DAYS);
    const fromStr = from.toISOString().slice(0, 10);
    const toStr = to.toISOString().slice(0, 10);

    const response = await fetch(
      `https://api.polygon.io/v2/aggs/ticker/${encodeURIComponent(
        symbol
      )}/range/1/day/${fromStr}/${toStr}?adjusted=true&sort=asc&limit=${GOLD_SILVER_HISTORY_LOOKBACK_DAYS + 5}&apiKey=${apiKey}`
    );
    if (!response.ok) return null;

    const data = await response.json().catch(() => null);
    const bars: Array<{ c: number; t: number }> = Array.isArray(data?.results) ? data.results : [];
    if (bars.length === 0) return null;

    return bars.map((bar) => ({ time: Math.floor(bar.t / 1000), value: bar.c }));
  } catch {
    return null;
  }
}

// Gold/silver only now — the loop's original per-symbol spacing (12s) is
// widened slightly since it only ever runs against Polygon's 2 symbols.
function ensureGoldSilverHistoryBackfill() {
  if (commodityHistoryBackfillRunning || !process.env.POLYGON_API_KEY) return;
  commodityHistoryBackfillRunning = true;

  (async () => {
    try {
      for (const symbol of ["C:XAUUSD", "C:XAGUSD"]) {
        const now = Date.now();
        const cached = commodityHistoryCache.get(symbol);
        if (cached && cached.expiresAt > now) continue;

        const data = await fetchPolygonHistory(symbol);
        // Only overwritten on success — a failed refetch leaves the prior
        // (expired-by-TTL, but still present) entry in place, so a
        // transient Polygon hiccup keeps serving the last known-good
        // sparkline instead of going blank.
        if (data) {
          commodityHistoryCache.set(symbol, { data, expiresAt: Date.now() + GOLD_SILVER_HISTORY_TTL_MS });
        }
        await new Promise((resolve) => setTimeout(resolve, GOLD_SILVER_HISTORY_FETCH_SPACING_MS));
      }
    } finally {
      commodityHistoryBackfillRunning = false;
    }
  })();
}

export async function GET() {
  const [finnhubResults, polygonResults, extraCommodityResults, twelveDataSparklines] = await Promise.all([
    getFinnhubGroup(),
    getPolygonGroup(),
    getExtraCommodityGroup(),
    fetchStockSparklines(TWELVEDATA_COMMODITY_SYMBOLS),
  ]);
  ensureGoldSilverHistoryBackfill();

  // Per-asset failures (missing key, rate limit, bad symbol) resolve to
  // null above rather than throwing, so one bad symbol never breaks the
  // rest of the ticker — it just renders as missing data on the client.
  const items: TickerItem[] = ASSET_DEFS.map((def) => {
    const result =
      def.provider === "finnhub" ? finnhubResults.get(def.symbol) : polygonResults.get(def.symbol);

    return {
      symbol: def.symbol,
      label: def.label,
      price: result?.price ?? null,
      change: result?.change ?? null,
      percentChange: result?.percentChange ?? null,
      stale: result?.stale ?? false,
    };
  });

  // Gold/silver/WTI are already fetched above for the ticker bar — reused
  // here via the same cached results rather than fetched a second time.
  const commodities: CommodityItem[] = Object.keys(COMMODITY_NAMES).map((symbol) => {
    const result =
      symbol === "C:XAUUSD" || symbol === "C:XAGUSD"
        ? polygonResults.get(symbol)
        : symbol === "USO"
          ? finnhubResults.get(symbol)
          : extraCommodityResults.get(symbol);

    return {
      symbol,
      name: COMMODITY_NAMES[symbol],
      price: result?.price ?? null,
      change: result?.change ?? null,
      percentChange: result?.percentChange ?? null,
      history:
        symbol === "C:XAUUSD" || symbol === "C:XAGUSD"
          ? commodityHistoryCache.get(symbol)?.data ?? null
          : twelveDataSparklines.get(symbol)?.points ?? null,
      stale: result?.stale ?? false,
    };
  });

  return NextResponse.json({ items, commodities });
}
