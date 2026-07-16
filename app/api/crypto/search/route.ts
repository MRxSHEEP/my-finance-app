import { NextRequest, NextResponse } from "next/server";
import { withCache } from "@/lib/newsCache";

export const dynamic = "force-dynamic";

const CACHE_TTL_MS = 2 * 60_000;
const MAX_RESULTS = 8;

interface SearchResult {
  id: string;
  symbol: string;
  name: string;
  marketCapRank: number | null;
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim();
  if (!query) {
    return NextResponse.json(
      { error: "Missing required query parameter: q" },
      { status: 400 }
    );
  }

  const results = await withCache(
    `crypto:search:${query.toLowerCase()}`,
    CACHE_TTL_MS,
    async (): Promise<SearchResult[]> => {
      const response = await fetch(
        `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(query)}`
      ).catch(() => null);
      if (!response?.ok) return [];

      const body = await response.json().catch(() => null);
      const coins: Array<{ id: string; symbol: string; name: string; market_cap_rank: number | null }> =
        Array.isArray(body?.coins) ? body.coins : [];

      // CoinGecko's search doesn't rank by relevance to trading volume,
      // so a query like "a" can surface obscure tokens above well-known
      // ones — sorting by market cap rank (nulls last) keeps the results
      // that actually matter at the top.
      return coins
        .slice()
        .sort((a, b) => {
          if (a.market_cap_rank === null) return 1;
          if (b.market_cap_rank === null) return -1;
          return a.market_cap_rank - b.market_cap_rank;
        })
        .slice(0, MAX_RESULTS)
        .map((coin) => ({
          id: coin.id,
          symbol: coin.symbol,
          name: coin.name,
          marketCapRank: coin.market_cap_rank,
        }));
    }
  );

  return NextResponse.json({ results });
}
