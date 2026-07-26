import { NextRequest, NextResponse } from "next/server";
import { withCache } from "@/lib/newsCache";

export const dynamic = "force-dynamic";

// Supported networks/contract addresses and exchange listings barely
// change day to day (unlike price), so this gets a much longer TTL than
// the price/history routes — one more reason to keep it a separate
// endpoint rather than folding it into /api/crypto/detail, which is
// re-fetched on every range/chart-type change.
const CACHE_TTL_MS = 30 * 60_000;
const MAX_TICKERS = 8;

interface CoinInfoResponse {
  platforms: Array<{ network: string; contractAddress: string }>;
  tickers: Array<{
    exchange: string;
    pair: string;
    volumeUsd: number | null;
    trustScore: string | null;
  }>;
}

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id")?.trim();
  if (!id) {
    return NextResponse.json({ error: "Missing required query parameter: id" }, { status: 400 });
  }

  const data = await withCache(
    `crypto:coin-info:${id}`,
    CACHE_TTL_MS,
    async (): Promise<CoinInfoResponse> => {
      const response = await fetch(
        `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(id)}?localization=false&tickers=true&market_data=false&community_data=false&developer_data=false`
      ).catch(() => null);
      if (!response?.ok) return { platforms: [], tickers: [] };

      const body = await response.json().catch(() => null);
      if (!body) return { platforms: [], tickers: [] };

      const platformsMap: Record<string, string> = body.platforms ?? {};
      const platforms = Object.entries(platformsMap)
        .filter(([network, address]) => network && address)
        .map(([network, address]) => ({ network, contractAddress: address }));

      const rawTickers: Array<{
        market?: { name?: string };
        base?: string;
        target?: string;
        converted_volume?: { usd?: number };
        trust_score?: string;
      }> = Array.isArray(body.tickers) ? body.tickers : [];

      const tickers = rawTickers
        .map((ticker) => ({
          exchange: ticker.market?.name ?? "Unknown",
          pair: `${ticker.base ?? "?"}/${ticker.target ?? "?"}`,
          volumeUsd: ticker.converted_volume?.usd ?? null,
          trustScore: ticker.trust_score ?? null,
        }))
        .sort((a, b) => (b.volumeUsd ?? 0) - (a.volumeUsd ?? 0))
        .slice(0, MAX_TICKERS);

      return { platforms, tickers };
    }
  );

  return NextResponse.json(data);
}
