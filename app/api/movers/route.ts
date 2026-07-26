import { NextResponse } from "next/server";
import { SCREENER_TICKERS } from "@/lib/screenerTickers";
import { fetchFinnhubQuote } from "@/lib/finnhubQuoteCache";

export const dynamic = "force-dynamic";

// No stock-side "top gainers/losers" ranking exists anywhere in this app —
// the crypto equivalent (components/crypto/MarketOverview.tsx's TopMovers)
// sorts one already-fetched dataset descending/ascending by percentChange24h
// and slices the top N; that's the pattern mirrored here, applied to real
// stock quotes via lib/finnhubQuoteCache.ts's fetchFinnhubQuote (reused
// as-is, already stale-fallback-safe). The outer batching/caching
// architecture mirrors app/api/screener/route.ts's own — same
// TICKERS_PER_BATCH/BATCH_PAUSE_MS pacing against Finnhub's 60/min
// free-tier cap — but with a much shorter TTL, since %change is far more
// time-sensitive than the fundamentals Screener caches for a full hour.
const CACHE_TTL_MS = 5 * 60_000;
const TICKERS_PER_BATCH = 25;
const BATCH_PAUSE_MS = 61_000;
const MOVERS_COUNT = 5;

export interface MoverRow {
  symbol: string;
  price: number;
  percentChange: number;
}

interface MoversData {
  gainers: MoverRow[];
  losers: MoverRow[];
  updatedAt: number;
}

let cache: { data: MoversData; expiresAt: number } | null = null;
let inflight: Promise<MoversData> | null = null;

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

async function buildMoversData(apiKey: string): Promise<MoversData> {
  const batches = chunk(SCREENER_TICKERS, TICKERS_PER_BATCH);
  const rows: MoverRow[] = [];

  for (let i = 0; i < batches.length; i++) {
    const batchStart = Date.now();
    const results = await Promise.all(
      batches[i].map(async (symbol) => {
        const result = await fetchFinnhubQuote(symbol, apiKey);
        if (!result.quote) return null;
        return { symbol, price: result.quote.price, percentChange: result.quote.percentChange };
      })
    );
    rows.push(...results.filter((row): row is MoverRow => row !== null));

    const isLastBatch = i === batches.length - 1;
    if (!isLastBatch) {
      const elapsed = Date.now() - batchStart;
      const remaining = BATCH_PAUSE_MS - elapsed;
      if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining));
    }
  }

  const gainers = [...rows].sort((a, b) => b.percentChange - a.percentChange).slice(0, MOVERS_COUNT);
  const losers = [...rows].sort((a, b) => a.percentChange - b.percentChange).slice(0, MOVERS_COUNT);

  return { gainers, losers, updatedAt: Date.now() };
}

export async function GET() {
  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Server is missing FINNHUB_API_KEY configuration" }, { status: 500 });
  }

  const now = Date.now();
  if (cache && cache.expiresAt > now) {
    return NextResponse.json(cache.data);
  }

  if (!inflight) {
    inflight = buildMoversData(apiKey).then((data) => {
      cache = { data, expiresAt: Date.now() + CACHE_TTL_MS };
      inflight = null;
      return data;
    });
  }

  const data = await inflight;
  return NextResponse.json(data);
}
