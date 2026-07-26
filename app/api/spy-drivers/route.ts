import { NextRequest, NextResponse } from "next/server";
import { withCache } from "@/lib/newsCache";

export const dynamic = "force-dynamic";

// Matches /api/stock/mini-quotes's own quote freshness (see that route) —
// this is pure arithmetic over live quotes, so it's only as fresh as the
// quotes themselves; no reason to cache longer than they do.
const CACHE_TTL_MS = 45_000;

// Approximate S&P 500 index weights for the Magnificent 7, as commonly
// reported by index-fact-sheet sources in recent years. These are static,
// hand-maintained approximations, NOT a live feed — no free-tier provider
// this app uses exposes real-time constituent weights. GOOGL is Alphabet's
// Class A weight only; Class C (GOOG) isn't tracked separately by this
// app, so Alphabet's true combined weight is somewhat higher than shown
// here. Update these periodically as index composition shifts.
const WEIGHTS_AS_OF = "mid-2026";
const MAG7_WEIGHTS: Record<string, number> = {
  AAPL: 0.07,
  MSFT: 0.065,
  NVDA: 0.065,
  AMZN: 0.038,
  GOOGL: 0.02,
  META: 0.025,
  TSLA: 0.018,
};

const MAG7_NAMES: Record<string, string> = {
  AAPL: "Apple",
  MSFT: "Microsoft",
  NVDA: "Nvidia",
  AMZN: "Amazon",
  GOOGL: "Alphabet",
  META: "Meta",
  TSLA: "Tesla",
};

interface MiniQuote {
  symbol: string;
  percentChange: number | null;
}

async function fetchMiniQuotes(symbols: string[], origin: string): Promise<MiniQuote[]> {
  try {
    const url = new URL(`/api/stock/mini-quotes?symbols=${symbols.join(",")}&sparkline=false`, origin);
    const response = await fetch(url);
    if (!response.ok) return [];
    const body = await response.json().catch(() => null);
    return Array.isArray(body?.quotes) ? body.quotes : [];
  } catch {
    return [];
  }
}

interface DriverEntry {
  symbol: string;
  name: string;
  percentChange: number | null;
  weight: number;
  contribution: number | null;
}

interface SpyDriversResponse {
  spyPercentChange: number | null;
  drivers: DriverEntry[];
  restOfIndexContribution: number | null;
  weightsAsOf: string;
  generatedAt: string;
}

export async function GET(request: NextRequest) {
  const data = await withCache("spy-drivers", CACHE_TTL_MS, async (): Promise<SpyDriversResponse> => {
    const symbols = ["SPY", ...Object.keys(MAG7_WEIGHTS)];
    const quotes = await fetchMiniQuotes(symbols, request.nextUrl.origin);
    const bySymbol = new Map(quotes.map((quote) => [quote.symbol, quote]));

    const spyPercentChange = bySymbol.get("SPY")?.percentChange ?? null;

    // contribution ≈ stock's % change × its index weight — e.g. a stock
    // up 2% at a 7% index weight contributes +0.14 percentage points to
    // SPY's overall % move.
    const drivers: DriverEntry[] = Object.entries(MAG7_WEIGHTS)
      .map(([symbol, weight]) => {
        const percentChange = bySymbol.get(symbol)?.percentChange ?? null;
        return {
          symbol,
          name: MAG7_NAMES[symbol],
          percentChange,
          weight,
          contribution: percentChange !== null ? percentChange * weight : null,
        };
      })
      .sort((a, b) => Math.abs(b.contribution ?? 0) - Math.abs(a.contribution ?? 0));

    // Everything SPY moved that the Mag 7 alone doesn't explain — the
    // other ~493 constituents combined. Only computable when SPY's own
    // quote is actually available; otherwise there's no total to
    // subtract from.
    const mag7ContributionSum = drivers.reduce((sum, d) => sum + (d.contribution ?? 0), 0);
    const restOfIndexContribution =
      spyPercentChange !== null ? spyPercentChange - mag7ContributionSum : null;

    return {
      spyPercentChange,
      drivers,
      restOfIndexContribution,
      weightsAsOf: WEIGHTS_AS_OF,
      generatedAt: new Date().toISOString(),
    };
  });

  return NextResponse.json(data);
}
