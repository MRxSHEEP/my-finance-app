import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface CoinDef {
  // Finnhub quotes use the Binance pair "{base}USDT"; Polygon aggregates
  // use the forex-style pair "X:{base}USD".
  base: string;
  name: string;
}

// Finnhub's free tier has no market-movers/ranking endpoint for crypto —
// confirmed live: both /crypto/candle and /scan/technical-indicator return
// "You don't have access to this resource" on this key, and /crypto/symbol
// only lists ~3,500 raw trading pairs with no volume field to rank by. So
// "top 8 most-traded" falls back to a fixed list of majors by market cap
// rather than a live volume ranking.
const COINS: CoinDef[] = [
  { base: "BTC", name: "Bitcoin" },
  { base: "ETH", name: "Ethereum" },
  { base: "BNB", name: "BNB" },
  { base: "SOL", name: "Solana" },
  { base: "XRP", name: "XRP" },
  { base: "DOGE", name: "Dogecoin" },
  { base: "ADA", name: "Cardano" },
  { base: "AVAX", name: "Avalanche" },
];

interface QuoteResult {
  price: number;
  change: number;
  percentChange: number;
}

interface HistoryPoint {
  time: number;
  value: number;
}

interface CoinPayload {
  symbol: string;
  name: string;
  price: number | null;
  change: number | null;
  percentChange: number | null;
  history: HistoryPoint[] | null;
}

// ---------------------------------------------------------------------
// Quotes — Finnhub, cheap and fast, refreshed often (same shape/approach
// as app/api/ticker/route.ts).
// ---------------------------------------------------------------------

const QUOTE_TTL_MS = 20_000;
let quoteCache: { data: Map<string, QuoteResult | null>; expiresAt: number } | null = null;
let quoteInflight: Promise<Map<string, QuoteResult | null>> | null = null;

async function fetchQuote(base: string): Promise<QuoteResult | null> {
  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) return null;

  try {
    const response = await fetch(
      `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(`BINANCE:${base}USDT`)}&token=${apiKey}`
    );
    if (!response.ok) return null;

    const data = await response.json().catch(() => null);
    const hasData =
      data && (data.c !== 0 || data.h !== 0 || data.l !== 0 || data.o !== 0 || data.pc !== 0);
    if (!hasData) return null;

    return { price: data.c, change: data.d, percentChange: data.dp };
  } catch {
    return null;
  }
}

async function getQuotes(): Promise<Map<string, QuoteResult | null>> {
  const now = Date.now();
  if (quoteCache && quoteCache.expiresAt > now) return quoteCache.data;
  if (quoteInflight) return quoteInflight;

  quoteInflight = (async () => {
    const entries = await Promise.all(
      COINS.map(async (coin) => [coin.base, await fetchQuote(coin.base)] as const)
    );
    const data = new Map(entries);
    quoteCache = { data, expiresAt: Date.now() + QUOTE_TTL_MS };
    quoteInflight = null;
    return data;
  })();

  return quoteInflight;
}

// ---------------------------------------------------------------------
// History — Polygon daily aggregates for the mini sparklines. Polygon's
// Basic (free) plan allows only 5 calls/minute account-wide (confirmed
// live: a 6th rapid call returned 429, and the budget resets on
// something closer to a fixed ~60s window than a smooth trickle —
// retrying 15s after exhausting it still failed, 30s succeeded). That
// budget is shared with the gold/silver quotes in
// app/api/ticker/route.ts (2 calls/60s there), which runs on every page
// including this one.
//
// TwelveData was considered instead (also already configured), but it's
// actively used by the /stocks page's own chart loading, so its budget
// is unpredictably shared with whatever a user is doing there; Polygon's
// usage across this app is fully enumerable (just the ticker + this
// route), which makes it possible to pace deliberately rather than race.
//
// So: fetch one coin at a time, spaced 25s apart (≈2.4 calls/60s),
// leaving clear headroom above the ticker's 2/60s within the shared
// 5/60s cap. Each result is cached for 10 minutes, since a 30-day daily
// sparkline barely changes minute to minute — the trickle only needs to
// fully populate once per 10-minute window, not on every poll. The
// route never blocks a response on this: it serves whatever's cached
// (possibly nothing, on a cold start) and backfills in the background,
// so the initial page load doesn't hang for minutes waiting on a
// deliberately slow, rate-limited fetch queue — later polls pick up
// newly-backfilled coins as they complete.
const HISTORY_TTL_MS = 10 * 60_000;
const HISTORY_FETCH_SPACING_MS = 25_000;
const HISTORY_LOOKBACK_DAYS = 30;

const historyCache = new Map<string, { data: HistoryPoint[]; expiresAt: number }>();
let historyBackfillRunning = false;

async function fetchHistory(base: string): Promise<HistoryPoint[] | null> {
  const apiKey = process.env.POLYGON_API_KEY;
  if (!apiKey) return null;

  try {
    const to = new Date();
    const from = new Date(to);
    from.setUTCDate(from.getUTCDate() - HISTORY_LOOKBACK_DAYS);
    const fromStr = from.toISOString().slice(0, 10);
    const toStr = to.toISOString().slice(0, 10);

    const response = await fetch(
      `https://api.polygon.io/v2/aggs/ticker/${encodeURIComponent(
        `X:${base}USD`
      )}/range/1/day/${fromStr}/${toStr}?adjusted=true&sort=asc&limit=${HISTORY_LOOKBACK_DAYS + 5}&apiKey=${apiKey}`
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

function ensureHistoryBackfill() {
  if (historyBackfillRunning || !process.env.POLYGON_API_KEY) return;
  historyBackfillRunning = true;

  (async () => {
    try {
      for (const coin of COINS) {
        const now = Date.now();
        const cached = historyCache.get(coin.base);
        if (cached && cached.expiresAt > now) continue;

        const data = await fetchHistory(coin.base);
        if (data) {
          historyCache.set(coin.base, { data, expiresAt: Date.now() + HISTORY_TTL_MS });
        }
        await new Promise((resolve) => setTimeout(resolve, HISTORY_FETCH_SPACING_MS));
      }
    } finally {
      historyBackfillRunning = false;
    }
  })();
}

export async function GET() {
  const quotes = await getQuotes();
  ensureHistoryBackfill();

  const coins: CoinPayload[] = COINS.map((coin) => {
    const quote = quotes.get(coin.base);
    return {
      symbol: coin.base,
      name: coin.name,
      price: quote?.price ?? null,
      change: quote?.change ?? null,
      percentChange: quote?.percentChange ?? null,
      history: historyCache.get(coin.base)?.data ?? null,
    };
  });

  return NextResponse.json({ coins });
}
