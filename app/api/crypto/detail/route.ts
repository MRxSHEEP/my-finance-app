import { NextRequest, NextResponse } from "next/server";
import { withCache } from "@/lib/newsCache";
import type { Range } from "@/components/PriceChart";

export const dynamic = "force-dynamic";

// Same rate-limit reasoning as the rankings/search routes — CoinGecko's
// free tier has no meaningful headroom, so this caches aggressively per
// (coin, range, chart type) combination. History for a past range barely
// changes minute to minute anyway.
const CACHE_TTL_MS = 5 * 60_000;

interface HistoryPointOut {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

interface CryptoOverview {
  id: string;
  symbol: string;
  name: string;
  currentPrice: number;
  percentChange24h: number | null;
  marketCap: number;
  totalVolume: number;
  circulatingSupply: number | null;
  ath: number | null;
  athDate: string | null;
  atl: number | null;
  atlDate: string | null;
}

interface CryptoDetailData {
  overview: CryptoOverview | null;
  history: HistoryPointOut[];
}

function daysForRange(range: Range): number | "max" {
  switch (range) {
    case "1D":
      return 1;
    case "1W":
      return 7;
    case "1M":
      return 30;
    case "3M":
      return 90;
    case "YTD": {
      const now = new Date();
      const jan1 = Date.UTC(now.getUTCFullYear(), 0, 1);
      return Math.max(1, Math.ceil((now.getTime() - jan1) / 86_400_000));
    }
    case "1Y":
      return 365;
    case "5Y":
      return 1825;
    case "MAX":
      return "max";
    default:
      return 30;
  }
}

// PriceChart's toUnixTime() expects either "YYYY-MM-DD" (date-only) or
// "YYYY-MM-DD HH:mm:ss" (space-separated intraday) — not a bare ISO
// string with a "T", which it would mishandle. Always using the
// space-separated form here is safe for both granularities; the chart's
// own range-based tick formatter controls display granularity, not this
// string's shape.
function msToChartDate(ms: number): string {
  const iso = new Date(ms).toISOString();
  return `${iso.slice(0, 10)} ${iso.slice(11, 19)}`;
}

async function fetchOverview(id: string): Promise<CryptoOverview | null> {
  const response = await fetch(
    `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${encodeURIComponent(id)}`
  ).catch(() => null);
  if (!response?.ok) return null;

  const body = await response.json().catch(() => null);
  const coin = Array.isArray(body) ? body[0] : null;
  if (!coin) return null;

  return {
    id: coin.id,
    symbol: coin.symbol,
    name: coin.name,
    currentPrice: coin.current_price,
    percentChange24h: coin.price_change_percentage_24h ?? null,
    marketCap: coin.market_cap,
    totalVolume: coin.total_volume,
    circulatingSupply: coin.circulating_supply ?? null,
    ath: coin.ath ?? null,
    athDate: coin.ath_date ?? null,
    atl: coin.atl ?? null,
    atlDate: coin.atl_date ?? null,
  };
}

async function fetchLineHistory(id: string, days: number | "max"): Promise<HistoryPointOut[]> {
  const response = await fetch(
    `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(id)}/market_chart?vs_currency=usd&days=${days}`
  ).catch(() => null);
  if (!response?.ok) return [];

  const body = await response.json().catch(() => null);
  const prices: Array<[number, number]> = Array.isArray(body?.prices) ? body.prices : [];

  return prices.map(([ms, price]) => ({
    date: msToChartDate(ms),
    open: price,
    high: price,
    low: price,
    close: price,
  }));
}

async function fetchCandlestickHistory(id: string, days: number | "max"): Promise<HistoryPointOut[]> {
  // CoinGecko's OHLC endpoint doesn't accept "max" — fall back to the
  // widest supported window instead of erroring.
  const effectiveDays = days === "max" ? 365 : days;
  const response = await fetch(
    `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(id)}/ohlc?vs_currency=usd&days=${effectiveDays}`
  ).catch(() => null);
  if (!response?.ok) return [];

  const body = await response.json().catch(() => null);
  const bars: Array<[number, number, number, number, number]> = Array.isArray(body) ? body : [];

  return bars.map(([ms, open, high, low, close]) => ({
    date: msToChartDate(ms),
    open,
    high,
    low,
    close,
  }));
}

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id")?.trim();
  const range = (request.nextUrl.searchParams.get("range") as Range | null) ?? "1M";
  const chartType = request.nextUrl.searchParams.get("chartType") === "candlestick" ? "candlestick" : "line";

  if (!id) {
    return NextResponse.json({ error: "Missing required query parameter: id" }, { status: 400 });
  }

  const data = await withCache(
    `crypto:detail:${id}:${range}:${chartType}`,
    CACHE_TTL_MS,
    async (): Promise<CryptoDetailData> => {
      const days = daysForRange(range);
      const [overview, history] = await Promise.all([
        fetchOverview(id),
        chartType === "candlestick" ? fetchCandlestickHistory(id, days) : fetchLineHistory(id, days),
      ]);

      return { overview, history };
    }
  );

  return NextResponse.json(data);
}
