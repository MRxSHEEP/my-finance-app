import { NextRequest, NextResponse } from "next/server";
import { fetchStockSparklines } from "@/lib/sparklineFetch";
import { fetchFinnhubQuote } from "@/lib/finnhubQuoteCache";

export const dynamic = "force-dynamic";

// Bounds the worst case per request — the largest caller today is the
// Stock Catalog's one page of 20 rows.
const MAX_SYMBOLS = 25;

interface MiniQuote {
  symbol: string;
  price: number | null;
  change: number | null;
  percentChange: number | null;
  history: { time: number; value: number }[] | null;
  // True when `history` is last-known-good data served because the live
  // TwelveData fetch failed (rate limit/quota/outage) — see
  // lib/sparklineFetch.ts. False (not just absent) once a symbol has been
  // fetched at all, so the client can tell "no data, never marked stale"
  // apart from "still loading."
  sparklineStale: boolean;
  // Same idea as sparklineStale, but for the price/change fields — see
  // lib/finnhubQuoteCache.ts.
  priceStale: boolean;
}

export async function GET(request: NextRequest) {
  const symbolsParam = request.nextUrl.searchParams.get("symbols") ?? "";
  const symbols = Array.from(
    new Set(
      symbolsParam
        .split(",")
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean)
    )
  ).slice(0, MAX_SYMBOLS);

  if (symbols.length === 0) {
    return NextResponse.json(
      { error: "Missing required query parameter: symbols" },
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

  // Sparkline history goes through a shared, deliberately slow throttle
  // (lib/sparklineFetch.ts — ~7.6s/symbol, serialized across every caller
  // process-wide) since it protects TwelveData's tight free-tier rate
  // limit. Callers that only need price/change (e.g. market-pulse, which
  // never renders a chart) can skip it entirely and get a fast response.
  const includeSparkline = request.nextUrl.searchParams.get("sparkline") !== "false";

  const [quotes, sparklines] = await Promise.all([
    Promise.all(symbols.map((symbol) => fetchFinnhubQuote(symbol, apiKey))),
    includeSparkline ? fetchStockSparklines(symbols) : Promise.resolve(new Map()),
  ]);

  const results: MiniQuote[] = symbols.map((symbol, index) => {
    const result = quotes[index];
    const sparkline = sparklines.get(symbol);
    return {
      symbol,
      price: result.quote?.price ?? null,
      change: result.quote?.change ?? null,
      percentChange: result.quote?.percentChange ?? null,
      history: sparkline?.points ?? null,
      sparklineStale: sparkline?.stale ?? false,
      priceStale: result.stale,
    };
  });

  return NextResponse.json({ quotes: results });
}
