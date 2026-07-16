import { NextResponse } from "next/server";
import { withCache } from "@/lib/newsCache";

export const dynamic = "force-dynamic";

// CoinGecko's free public API has a very tight rate limit — confirmed
// live: a burst of a dozen rapid requests returned 429 after only the
// first 2 succeeded. There's no API key for this provider (by design,
// per the task — CoinGecko's free tier needs none), so the only lever
// available is aggressive server-side caching: this one dataset serves
// both the rankings table AND (client-side, sorted differently) the top
// movers section, and a 3-minute TTL means it's refetched at most 20
// times/hour regardless of how many users hit either section.
const CACHE_TTL_MS = 3 * 60_000;
const PER_PAGE = 50;

interface CoinRanking {
  id: string;
  symbol: string;
  name: string;
  image: string;
  currentPrice: number;
  marketCap: number;
  marketCapRank: number | null;
  totalVolume: number;
  percentChange24h: number | null;
}

export async function GET() {
  const coins = await withCache("crypto:rankings", CACHE_TTL_MS, async (): Promise<CoinRanking[]> => {
    const response = await fetch(
      `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${PER_PAGE}&page=1&price_change_percentage=24h`
    ).catch(() => null);

    if (!response?.ok) return [];

    const body = await response.json().catch(() => null);
    if (!Array.isArray(body)) return [];

    return body.map(
      (coin: {
        id: string;
        symbol: string;
        name: string;
        image: string;
        current_price: number;
        market_cap: number;
        market_cap_rank: number | null;
        total_volume: number;
        price_change_percentage_24h: number | null;
      }) => ({
        id: coin.id,
        symbol: coin.symbol,
        name: coin.name,
        image: coin.image,
        currentPrice: coin.current_price,
        marketCap: coin.market_cap,
        marketCapRank: coin.market_cap_rank,
        totalVolume: coin.total_volume,
        percentChange24h: coin.price_change_percentage_24h,
      })
    );
  });

  return NextResponse.json({ coins });
}
