import { NextResponse } from "next/server";

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
}

interface TickerItem {
  symbol: string;
  label: string;
  price: number | null;
  change: number | null;
  percentChange: number | null;
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

async function fetchFinnhubQuote(def: AssetDef): Promise<QuoteResult | null> {
  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) return null;

  try {
    const response = await fetch(
      `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(def.symbol)}&token=${apiKey}`
    );
    if (!response.ok) return null;

    const data = await response.json().catch(() => null);
    // Finnhub returns HTTP 200 with all-zero fields for unknown/unsupported
    // symbols rather than an error status.
    const hasData =
      data && (data.c !== 0 || data.h !== 0 || data.l !== 0 || data.o !== 0 || data.pc !== 0);
    if (!hasData) return null;

    return { price: data.c, change: data.d, percentChange: data.dp };
  } catch {
    return null;
  }
}

async function fetchPolygonQuote(def: AssetDef): Promise<QuoteResult | null> {
  const apiKey = process.env.POLYGON_API_KEY;
  if (!apiKey) return null;

  try {
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
        def.symbol
      )}/range/1/day/${fromStr}/${toStr}?adjusted=true&sort=desc&limit=2&apiKey=${apiKey}`
    );
    if (!response.ok) return null;

    const data = await response.json().catch(() => null);
    const bars: Array<{ c: number }> = Array.isArray(data?.results) ? data.results : [];
    if (bars.length === 0) return null;

    const [latest, previous] = bars;
    if (!previous) return { price: latest.c, change: 0, percentChange: 0 };

    const change = latest.c - previous.c;
    const percentChange = previous.c !== 0 ? (change / previous.c) * 100 : 0;
    return { price: latest.c, change, percentChange };
  } catch {
    return null;
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

// Friendly display names for the /commodities page's price grid — the
// short `label` codes above are sized for the dense top ticker bar, not
// full card titles.
const COMMODITY_NAMES: Record<string, string> = {
  "C:XAUUSD": "Gold",
  "C:XAGUSD": "Silver",
  USO: "Crude Oil (WTI)",
  BNO: "Brent Crude",
  UNG: "Natural Gas",
  CPER: "Copper",
  CORN: "Corn",
  WEAT: "Wheat",
  SOYB: "Soybeans",
};

// ---------------------------------------------------------------------
// Sparkline history for the /commodities page's price grid. Gold/silver
// go through Polygon (same forex-pair aggregates already used for their
// quotes above); the seven ETF proxies go through TwelveData — the same
// provider/endpoint the stocks page's own chart already uses for OHLC
// history, rather than Finnhub (whose free tier has no historical-candle
// access for stocks/ETFs).
//
// Both providers' budgets here are shared with other consumers already
// running elsewhere in the app, so this backfills in the background on a
// long TTL rather than fetching per-request:
//   Polygon (2 symbols, gold/silver): shares the same 5 calls/min
//     account-wide cap as this route's own gold/silver QUOTES (2/60s
//     above) and the crypto page's coin-history trickle (~2.4/60s during
//     its own backfill bursts) — confirmed live earlier that a 6th rapid
//     call returns 429. A 30-minute TTL means these 2 calls only run once
//     every 30 min, spaced 20s apart within that run — negligible next to
//     the other two steady consumers, with the same accept-approximate-
//     pacing-over-perfect-coordination approach the crypto route already
//     documents for the same shared budget.
//   TwelveData (7 symbols): free tier is 8 calls/min, 800/day (verified).
//     Spaced 12s apart, a full backfill run takes ~84s and peaks at
//     5 calls/min — under the 8/min cap with headroom for whatever the
//     stocks page's own chart is doing concurrently. At a 30-minute TTL
//     that's 7 * 48 = 336 calls/day, well under the 800/day cap.
// Neither refresh blocks this route's response: it serves whatever's
// cached (possibly nothing on a cold start) and backfills in the
// background, exactly like the crypto route's own history mechanism.
const COMMODITY_HISTORY_TTL_MS = 30 * 60_000;
const COMMODITY_HISTORY_FETCH_SPACING_MS = 12_000;
const COMMODITY_HISTORY_LOOKBACK_DAYS = 30;

const COMMODITY_HISTORY_SOURCE: Record<string, "polygon" | "twelvedata"> = {
  "C:XAUUSD": "polygon",
  "C:XAGUSD": "polygon",
  USO: "twelvedata",
  BNO: "twelvedata",
  UNG: "twelvedata",
  CPER: "twelvedata",
  CORN: "twelvedata",
  WEAT: "twelvedata",
  SOYB: "twelvedata",
};

const commodityHistoryCache = new Map<string, { data: HistoryPoint[]; expiresAt: number }>();
let commodityHistoryBackfillRunning = false;

async function fetchPolygonHistory(symbol: string): Promise<HistoryPoint[] | null> {
  const apiKey = process.env.POLYGON_API_KEY;
  if (!apiKey) return null;

  try {
    const to = new Date();
    const from = new Date(to);
    from.setUTCDate(from.getUTCDate() - COMMODITY_HISTORY_LOOKBACK_DAYS);
    const fromStr = from.toISOString().slice(0, 10);
    const toStr = to.toISOString().slice(0, 10);

    const response = await fetch(
      `https://api.polygon.io/v2/aggs/ticker/${encodeURIComponent(
        symbol
      )}/range/1/day/${fromStr}/${toStr}?adjusted=true&sort=asc&limit=${COMMODITY_HISTORY_LOOKBACK_DAYS + 5}&apiKey=${apiKey}`
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

async function fetchTwelveDataHistory(symbol: string): Promise<HistoryPoint[] | null> {
  const apiKey = process.env.TWELVEDATA_API_KEY;
  if (!apiKey) return null;

  try {
    const response = await fetch(
      `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(
        symbol
      )}&interval=1day&outputsize=${COMMODITY_HISTORY_LOOKBACK_DAYS}&apikey=${apiKey}`
    );
    if (!response.ok) return null;

    const data = await response.json().catch(() => null);
    if (data?.status === "error" || !Array.isArray(data?.values)) return null;

    const values: Array<{ datetime: string; close: string }> = data.values;
    // TwelveData returns newest-first; the chart needs ascending time order.
    return values
      .map((value) => ({
        time: Math.floor(new Date(value.datetime).getTime() / 1000),
        value: Number(value.close),
      }))
      .reverse();
  } catch {
    return null;
  }
}

function ensureCommodityHistoryBackfill() {
  const hasAnyKey = process.env.POLYGON_API_KEY || process.env.TWELVEDATA_API_KEY;
  if (commodityHistoryBackfillRunning || !hasAnyKey) return;
  commodityHistoryBackfillRunning = true;

  (async () => {
    try {
      for (const [symbol, provider] of Object.entries(COMMODITY_HISTORY_SOURCE)) {
        const now = Date.now();
        const cached = commodityHistoryCache.get(symbol);
        if (cached && cached.expiresAt > now) continue;

        const data =
          provider === "polygon" ? await fetchPolygonHistory(symbol) : await fetchTwelveDataHistory(symbol);
        if (data) {
          commodityHistoryCache.set(symbol, { data, expiresAt: Date.now() + COMMODITY_HISTORY_TTL_MS });
        }
        await new Promise((resolve) => setTimeout(resolve, COMMODITY_HISTORY_FETCH_SPACING_MS));
      }
    } finally {
      commodityHistoryBackfillRunning = false;
    }
  })();
}

export async function GET() {
  const [finnhubResults, polygonResults, extraCommodityResults] = await Promise.all([
    getFinnhubGroup(),
    getPolygonGroup(),
    getExtraCommodityGroup(),
  ]);
  ensureCommodityHistoryBackfill();

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
      history: commodityHistoryCache.get(symbol)?.data ?? null,
    };
  });

  return NextResponse.json({ items, commodities });
}
