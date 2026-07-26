import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { COMMODITY_NAMES } from "@/lib/commodityNames";
import { withCache } from "@/lib/newsCache";

export const dynamic = "force-dynamic";

// The ETF-proxy history path chains through /api/stock/history, whose own
// TwelveData fallback (primary interval, then a daily-interval retry) is
// serialized behind the app-wide throttle (lib/twelveDataThrottle.ts) —
// during a sustained outage/quota exhaustion, each attempt can spend a
// full ~7.6s in that shared queue before failing, and two chained
// attempts (this route fetches the chart range AND a separate 1Y series
// for 52-week stats) can compound well past 20s (confirmed live: 20.6s
// total for one request during today's TwelveData outage). Bounding each
// internal fetch keeps this route's own response time reasonable even
// when the upstream provider is degraded — the abandoned fetch still
// finishes in the background and populates the shared caches for next
// time, it just doesn't hold this response open waiting for it, mirroring
// lib/sparklineFetch.ts's own BATCH_WAIT_MS reasoning.
const INTERNAL_FETCH_TIMEOUT_MS = 8_000;

function withTimeout<T>(promise: Promise<T>, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), INTERNAL_FETCH_TIMEOUT_MS)),
  ]);
}

interface HistoryPoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

type Range = "1D" | "1W" | "1M" | "3M" | "1Y" | "MAX";
const RANGES: Range[] = ["1D", "1W", "1M", "3M", "1Y", "MAX"];

// Gold/silver are forex-pair spot rates via Polygon (see app/api/ticker's
// own gold/silver quote handling) — Polygon's free tier has no real-time/
// intraday snapshot access for these (confirmed live earlier: NOT_AUTHORIZED),
// so only daily bars are available and 1D/1W are disabled for these two
// symbols specifically, with an honest note rather than a fake chart. The
// seven ETF-proxy commodities are regular US-listed tickers, so they reuse
// /api/stock/history exactly like a stock would — including genuine
// intraday granularity for 1D/1W.
const GOLD_SILVER_SYMBOLS = new Set(["C:XAUUSD", "C:XAGUSD"]);

// Mirrors PriceChart's own DEFAULT_INTERVAL_FOR_RANGE (components/PriceChart.tsx)
// for the ETF-proxy symbols, which go through the exact same /api/stock/history
// route a stock detail chart would.
const INTERVAL_FOR_RANGE: Record<Range, string> = {
  "1D": "5min",
  "1W": "30min",
  "1M": "1h",
  "3M": "1day",
  "1Y": "1day",
  MAX: "1day",
};

// One-sentence, factual context per commodity — what it actually tracks,
// not a data-driven feature (no futures-chain provider is configured in
// this app), so this is static and hand-written rather than fetched.
const COMMODITY_ABOUT: Record<string, string> = {
  "C:XAUUSD":
    "Shown as the XAU/USD spot rate — troy ounces of gold priced in US dollars, the same benchmark gold futures and gold ETFs price against.",
  "C:XAGUSD":
    "Shown as the XAG/USD spot rate — troy ounces of silver priced in US dollars, the same benchmark silver futures and silver ETFs price against.",
  USO: "Tracks West Texas Intermediate (WTI) crude oil by holding front-month futures contracts. It closely follows WTI spot price but can drift from it over time due to futures roll costs.",
  BNO: "Tracks Brent crude oil futures — the international oil benchmark, distinct from WTI (primarily a US benchmark).",
  UNG: "Tracks near-month Henry Hub natural gas futures contracts.",
  CPER: "Tracks COMEX copper futures contracts.",
  CORN: "Tracks CBOT corn futures contracts.",
  WEAT: "Tracks CBOT wheat futures contracts.",
  SOYB: "Tracks CBOT soybean futures contracts.",
};

interface CommodityQuote {
  symbol: string;
  price: number | null;
  change: number | null;
  percentChange: number | null;
}

async function fetchLiveQuote(symbol: string, origin: string): Promise<CommodityQuote | null> {
  try {
    const response = await fetch(new URL("/api/ticker", origin));
    if (!response.ok) return null;
    const body = await response.json().catch(() => null);
    const commodities: CommodityQuote[] = Array.isArray(body?.commodities) ? body.commodities : [];
    return commodities.find((c) => c.symbol === symbol) ?? null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------
// ETF-proxy history (USO/BNO/UNG/CPER/CORN/WEAT/SOYB) — proxies straight
// through to /api/stock/history, the already-resilient (throttled,
// stale-cache-backed) generic history route stocks/crypto also use.
// ---------------------------------------------------------------------

async function fetchEtfProxyHistory(
  symbol: string,
  range: Range,
  origin: string
): Promise<HistoryPoint[] | null> {
  try {
    const url = new URL("/api/stock/history", origin);
    url.searchParams.set("ticker", symbol);
    url.searchParams.set("interval", INTERVAL_FOR_RANGE[range]);
    url.searchParams.set("range", range === "MAX" ? "MAX" : range);
    const response = await fetch(url);
    if (!response.ok) return null;
    const body = await response.json().catch(() => null);
    return Array.isArray(body?.history) ? body.history : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------
// Gold/silver history — Polygon forex-pair daily aggregates, fetched once
// as a single ~5-year series and cached (matching app/api/ticker's own
// stale-tolerant caching for these two symbols) rather than per range, so
// switching timeframes on the detail page never costs another upstream
// call — the server just slices the cached series.
// ---------------------------------------------------------------------

const GOLD_SILVER_LOOKBACK_DAYS = 1900;
const GOLD_SILVER_CACHE_TTL_MS = 30 * 60_000;
const goldSilverCache = new Map<string, { bars: HistoryPoint[]; expiresAt: number }>();

async function fetchPolygonFullHistory(symbol: string): Promise<HistoryPoint[] | null> {
  const apiKey = process.env.POLYGON_API_KEY;
  if (!apiKey) return null;

  try {
    const to = new Date();
    const from = new Date(to);
    from.setUTCDate(from.getUTCDate() - GOLD_SILVER_LOOKBACK_DAYS);
    const fromStr = from.toISOString().slice(0, 10);
    const toStr = to.toISOString().slice(0, 10);

    const response = await fetch(
      `https://api.polygon.io/v2/aggs/ticker/${encodeURIComponent(
        symbol
      )}/range/1/day/${fromStr}/${toStr}?adjusted=true&sort=asc&limit=5000&apiKey=${apiKey}`
    );
    if (!response.ok) return null;

    const data = await response.json().catch(() => null);
    const bars: Array<{ o: number; h: number; l: number; c: number; v?: number; t: number }> =
      Array.isArray(data?.results) ? data.results : [];
    if (bars.length === 0) return null;

    return bars.map((bar) => ({
      // Plain "YYYY-MM-DD" (not a full ISO timestamp) — matches every
      // other daily-bar HistoryPoint.date in this app (e.g. TwelveData's
      // own daily `datetime` field), which PriceChart's toUnixTime()
      // parses by appending "T00:00:00Z" itself. Passing an already-full
      // ISO string there double-appends a time suffix, producing an
      // unparseable string and NaN timestamps (confirmed live: threw
      // lightweight-charts' "data must be asc ordered by time... time=NaN").
      date: new Date(bar.t).toISOString().slice(0, 10),
      open: bar.o,
      high: bar.h,
      low: bar.l,
      close: bar.c,
      volume: bar.v,
    }));
  } catch {
    return null;
  }
}

async function getGoldSilverFullHistory(symbol: string): Promise<HistoryPoint[] | null> {
  const now = Date.now();
  const cached = goldSilverCache.get(symbol);
  if (cached && cached.expiresAt > now) return cached.bars;

  const bars = await fetchPolygonFullHistory(symbol);
  if (bars) {
    goldSilverCache.set(symbol, { bars, expiresAt: now + GOLD_SILVER_CACHE_TTL_MS });
    return bars;
  }
  // Refetch failed — serve the previous (expired-by-TTL but still present)
  // entry rather than nothing, same stale-fallback reasoning used
  // throughout the rest of this app's TwelveData/Polygon integrations.
  return cached?.bars ?? null;
}

const RANGE_LOOKBACK_DAYS: Record<Range, number> = {
  "1D": 2,
  "1W": 9,
  "1M": 35,
  "3M": 100,
  "1Y": 380,
  MAX: GOLD_SILVER_LOOKBACK_DAYS,
};

function sliceGoldSilverRange(bars: HistoryPoint[], range: Range): HistoryPoint[] {
  if (range === "MAX") return bars;
  const cutoff = Date.now() - RANGE_LOOKBACK_DAYS[range] * 24 * 60 * 60_000;
  const idx = bars.findIndex((bar) => new Date(bar.date).getTime() >= cutoff);
  if (idx <= 0) return bars;
  return bars.slice(idx - 1);
}

// ---------------------------------------------------------------------
// 52-week range / day range / previous close — derived from whichever
// full daily series is already being fetched above (the ETF-proxy path
// fetches a dedicated 1Y series for this; gold/silver reuse the cached
// ~5y series), rather than a separate quote call.
// ---------------------------------------------------------------------

interface DerivedStats {
  dayHigh: number | null;
  dayLow: number | null;
  previousClose: number | null;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
}

function deriveStats(dailyBars: HistoryPoint[]): DerivedStats {
  if (dailyBars.length === 0) {
    return { dayHigh: null, dayLow: null, previousClose: null, fiftyTwoWeekHigh: null, fiftyTwoWeekLow: null };
  }

  const oneYearAgo = Date.now() - 365 * 24 * 60 * 60_000;
  const lastYear = dailyBars.filter((bar) => new Date(bar.date).getTime() >= oneYearAgo);
  const yearBars = lastYear.length > 0 ? lastYear : dailyBars;

  const latest = dailyBars[dailyBars.length - 1];
  const previous = dailyBars.length > 1 ? dailyBars[dailyBars.length - 2] : null;

  return {
    dayHigh: latest.high,
    dayLow: latest.low,
    previousClose: previous ? previous.close : null,
    fiftyTwoWeekHigh: Math.max(...yearBars.map((bar) => bar.high)),
    fiftyTwoWeekLow: Math.min(...yearBars.map((bar) => bar.low)),
  };
}

// ---------------------------------------------------------------------
// "What changed?" — a brief, data-grounded explanation of the session's
// move, following the exact discipline app/api/market-pulse/route.ts
// already established: pass only real, fetched numbers into the prompt
// and explicitly forbid inventing any others. Cached per-symbol,
// independent of the range param, so switching timeframes on the detail
// page never re-triggers the (comparatively expensive/slow) AI call.
// ---------------------------------------------------------------------

const EXPLANATION_CACHE_TTL_MS = 15 * 60_000;

function buildExplanationPrompt(name: string, quote: CommodityQuote, stats: DerivedStats): string {
  const changeLine =
    quote.percentChange != null
      ? `${quote.percentChange >= 0 ? "+" : ""}${quote.percentChange.toFixed(2)}% today (${
          quote.change != null ? (quote.change >= 0 ? "+" : "") + quote.change.toFixed(2) : "change unavailable"
        })`
      : "not available";
  const rangeLine =
    stats.dayLow != null && stats.dayHigh != null
      ? `$${stats.dayLow.toFixed(2)} to $${stats.dayHigh.toFixed(2)}`
      : "not available";
  const prevCloseLine = stats.previousClose != null ? `$${stats.previousClose.toFixed(2)}` : "not available";

  return `Here is today's data for ${name}:

Price move: ${changeLine}
Today's trading range: ${rangeLine}
Previous close: ${prevCloseLine}

Write exactly 2 sentences in plain language for a retail investor, describing this price move. Cite only the specific figures given above. Do not invent news events, causes, or numbers that were not explicitly provided — if the data doesn't suggest an obvious cause, just describe the move itself (e.g. "little changed" / "a modest gain/decline") rather than speculating about why.`;
}

async function generateExplanation(
  symbol: string,
  name: string,
  quote: CommodityQuote | null,
  stats: DerivedStats
): Promise<string | null> {
  if (!process.env.ANTHROPIC_API_KEY || !quote || quote.percentChange == null) return null;

  return withCache(`commodity-explain:${symbol}`, EXPLANATION_CACHE_TTL_MS, async () => {
    try {
      const anthropic = new Anthropic();
      const message = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 120,
        messages: [{ role: "user", content: buildExplanationPrompt(name, quote, stats) }],
      });
      const textBlock = message.content.find((block) => block.type === "text");
      const generated = textBlock?.type === "text" ? textBlock.text.trim() : "";
      return generated || null;
    } catch (err) {
      console.error(
        `[commodities/detail] Anthropic request failed for ${symbol}: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
      return null;
    }
  });
}

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get("symbol");
  const rangeParam = request.nextUrl.searchParams.get("range") ?? "1M";

  if (!symbol || !(symbol in COMMODITY_NAMES)) {
    return NextResponse.json({ error: "Unknown commodity symbol" }, { status: 404 });
  }
  if (!RANGES.includes(rangeParam as Range)) {
    return NextResponse.json({ error: `Invalid range. Must be one of: ${RANGES.join(", ")}` }, { status: 400 });
  }
  const range = rangeParam as Range;
  const name = COMMODITY_NAMES[symbol];
  const isGoldSilver = GOLD_SILVER_SYMBOLS.has(symbol);
  const origin = request.nextUrl.origin;

  const historyPromise = withTimeout(
    isGoldSilver
      ? getGoldSilverFullHistory(symbol).then((bars) => (bars ? sliceGoldSilverRange(bars, range) : null))
      : fetchEtfProxyHistory(symbol, range, origin),
    null
  );
  // A dedicated ~1y+ daily series purely for 52-week/day-range/previous-
  // close math — independent of whatever granularity the chart itself
  // requested (which may be intraday for 1D/1W on the ETF-proxy path).
  const statsHistoryPromise = withTimeout(
    isGoldSilver
      ? getGoldSilverFullHistory(symbol).then((bars) => (bars ? sliceGoldSilverRange(bars, "1Y") : null))
      : fetchEtfProxyHistory(symbol, "1Y", origin),
    null
  );
  const quotePromise = withTimeout(fetchLiveQuote(symbol, origin), null);

  // The AI explanation only depends on the quote + stats (not the chart's
  // own history series), so it's kicked off as soon as those two resolve
  // rather than waiting on the full Promise.all below — meaningful when
  // the chart-range fetch is the slow one (e.g. a genuinely stale/never-
  // cached intraday request), since it lets the explanation run
  // concurrently with that instead of strictly after it.
  const explanationPromise = Promise.all([quotePromise, statsHistoryPromise]).then(
    ([quote, statsHistory]) => {
      const stats = deriveStats(statsHistory ?? []);
      return withTimeout(generateExplanation(symbol, name, quote, stats), null);
    }
  );

  const [history, statsHistory, quote, explanation] = await Promise.all([
    historyPromise,
    statsHistoryPromise,
    quotePromise,
    explanationPromise,
  ]);

  const stats = deriveStats(statsHistory ?? []);

  // 1D/1W are only meaningful when a real intraday source backs them —
  // that's true for the seven ETF-proxy commodities (they go through
  // /api/stock/history, the same intraday-capable route a stock chart
  // uses) but not for gold/silver, whose only source here (Polygon daily
  // aggregates) has no intraday access on this plan.
  const rangeEnabled: Record<Range, boolean> = {
    "1D": !isGoldSilver,
    "1W": !isGoldSilver,
    "1M": true,
    "3M": true,
    "1Y": true,
    MAX: true,
  };

  return NextResponse.json({
    symbol,
    name,
    about: COMMODITY_ABOUT[symbol] ?? null,
    history: history ?? [],
    quote: quote ?? { symbol, price: null, change: null, percentChange: null },
    stats,
    explanation,
    rangeEnabled,
    intradayAvailable: !isGoldSilver,
  });
}
