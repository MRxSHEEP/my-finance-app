import { NextRequest, NextResponse } from "next/server";
import { resolveTickerSymbol } from "@/lib/resolveTicker";
import { withCache } from "@/lib/newsCache";
import { fetchRecentDailyCloses } from "@/lib/stockHistoryCache";
import { fetchFinnhubQuote } from "@/lib/finnhubQuoteCache";

// Finnhub's market-status is per-exchange, not per-ticker — every AAPL,
// MSFT, etc. request in the same short window shares one cached answer
// instead of each paying for its own call.
const MARKET_STATUS_CACHE_TTL_MS = 30_000;

type Session = "pre-market" | "regular" | "post-market" | null;

interface MarketStatus {
  session: Session;
  isOpen: boolean;
}

async function fetchMarketStatus(apiKey: string): Promise<MarketStatus | null> {
  return withCache("market-status:US", MARKET_STATUS_CACHE_TTL_MS, async (): Promise<MarketStatus | null> => {
    try {
      const response = await fetch(`https://finnhub.io/api/v1/stock/market-status?exchange=US&token=${apiKey}`);
      if (!response.ok) return null;
      const body = await response.json().catch(() => null);
      if (!body) return null;

      const session: Session =
        body.session === "pre-market" || body.session === "post-market" || body.session === "regular"
          ? body.session
          : null;
      return { session, isOpen: Boolean(body.isOpen) };
    } catch {
      return null;
    }
  });
}

interface ExtendedHours {
  price: number;
  change: number;
  percentChange: number;
  regularClose: number;
  regularChange: number;
  regularPercentChange: number;
}

// Finnhub's free-tier /quote has no dedicated "extended hours price" field
// — during pre/post-market its own `c` already reflects the latest
// extended-hours trade, but there's no stable field for "today's regular
// session close" once trading moves past it. Daily bars don't have that
// problem (they finalize at the official close regardless of what trades
// afterward), so the two most recent ones give an authoritative regular
// close + the session-over-session change to go with it.
async function fetchExtendedHours(ticker: string, currentPrice: number): Promise<ExtendedHours | null> {
  const bars = await fetchRecentDailyCloses(ticker, 3);
  if (bars.length < 2) return null;

  const regularClose = bars[bars.length - 1].close;
  const priorClose = bars[bars.length - 2].close;
  if (!regularClose || !priorClose) return null;

  return {
    price: currentPrice,
    change: currentPrice - regularClose,
    percentChange: ((currentPrice - regularClose) / regularClose) * 100,
    regularClose,
    regularChange: regularClose - priorClose,
    regularPercentChange: ((regularClose - priorClose) / priorClose) * 100,
  };
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("ticker")?.trim();

  if (!query) {
    return NextResponse.json(
      { error: "Missing required query parameter: ticker" },
      { status: 400 }
    );
  }

  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Server is missing FINNHUB_API_KEY configuration" },
      { status: 500 }
    );
  }

  const ticker = await resolveTickerSymbol(query, apiKey);

  // Falls back to the last known-good quote (lib/finnhubQuoteCache.ts) when
  // Finnhub is rate-limited/down rather than erroring the whole page —
  // confirmed live that a same-day quota exhaustion previously surfaced as
  // "Finnhub API rate limit exceeded" with no chart/price at all, even
  // though a perfectly good quote had already been fetched minutes earlier.
  const { quote, stale, staleFetchedAt } = await fetchFinnhubQuote(ticker, apiKey);

  if (!quote) {
    return NextResponse.json(
      { error: `No data found for ticker "${ticker}" (Finnhub may be rate-limited and no prior quote is cached yet)` },
      { status: 404 }
    );
  }

  const marketStatus = await fetchMarketStatus(apiKey);

  let extendedHours: ExtendedHours | null = null;
  if (!stale && (marketStatus?.session === "pre-market" || marketStatus?.session === "post-market")) {
    extendedHours = await fetchExtendedHours(ticker, quote.price);
  }

  return NextResponse.json({
    ticker,
    close: quote.price,
    open: quote.open,
    high: quote.high,
    low: quote.low,
    previousClose: quote.previousClose,
    percentChange: quote.percentChange,
    change: quote.change,
    timestamp: quote.timestamp,
    marketStatus,
    extendedHours,
    stale,
    staleFetchedAt: staleFetchedAt ? new Date(staleFetchedAt).toISOString() : null,
  });
}
