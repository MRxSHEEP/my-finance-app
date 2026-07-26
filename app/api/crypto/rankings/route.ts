import { NextResponse } from "next/server";
import { withCache } from "@/lib/newsCache";
import type { CoinRanking } from "@/lib/cryptoTypes";

export const dynamic = "force-dynamic";

// CoinGecko's free public API has a very tight rate limit — confirmed
// live: a burst of a dozen rapid requests returned 429 after only the
// first 2 succeeded. There's no API key for this provider (by design,
// per the task — CoinGecko's free tier needs none), so the only lever
// available is aggressive server-side caching. This one dataset is now
// the single shared price/market source for the entire /crypto page —
// the rankings table, top movers, the "Top 8 Most-Traded" grid, and (for
// any coin present in it) the search/detail hero's own overview stats —
// so a 3-minute TTL protects the whole page's worth of traffic, not just
// one section, and just as importantly means every section reading it
// agrees on the same numbers for the same coin at the same moment.
const CACHE_TTL_MS = 3 * 60_000;
// 100 rather than 50 so the category tabs (DeFi/Layer 1/AI/Meme) in Top
// Movers have enough coins per category to be useful — still one request.
const PER_PAGE = 100;

interface RankingsResponse {
  coins: CoinRanking[];
  generatedAt: string;
}

export async function GET() {
  const { coins, generatedAt } = await withCache(
    "crypto:rankings",
    CACHE_TTL_MS,
    async (): Promise<RankingsResponse> => {
      const response = await fetch(
        `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${PER_PAGE}&page=1&sparkline=true&price_change_percentage=1h,24h,7d`
      ).catch(() => null);

      if (!response?.ok) return { coins: [], generatedAt: new Date().toISOString() };

      const body = await response.json().catch(() => null);
      if (!Array.isArray(body)) return { coins: [], generatedAt: new Date().toISOString() };

      const coins = body.map(
        (coin: {
          id: string;
          symbol: string;
          name: string;
          image: string;
          current_price: number;
          market_cap: number;
          market_cap_rank: number | null;
          total_volume: number;
          price_change_24h?: number | null;
          price_change_percentage_1h_in_currency?: number | null;
          price_change_percentage_24h_in_currency?: number | null;
          price_change_percentage_7d_in_currency?: number | null;
          sparkline_in_7d?: { price?: number[] };
          circulating_supply?: number | null;
        }): CoinRanking => ({
          id: coin.id,
          symbol: coin.symbol,
          name: coin.name,
          image: coin.image,
          currentPrice: coin.current_price,
          marketCap: coin.market_cap,
          marketCapRank: coin.market_cap_rank,
          totalVolume: coin.total_volume,
          priceChange24h: coin.price_change_24h ?? null,
          percentChange1h: coin.price_change_percentage_1h_in_currency ?? null,
          percentChange24h: coin.price_change_percentage_24h_in_currency ?? null,
          percentChange7d: coin.price_change_percentage_7d_in_currency ?? null,
          sparkline7d: Array.isArray(coin.sparkline_in_7d?.price) ? coin.sparkline_in_7d!.price! : null,
          circulatingSupply: coin.circulating_supply ?? null,
        })
      );

      return { coins, generatedAt: new Date().toISOString() };
    }
  );

  return NextResponse.json({ coins, generatedAt });
}
