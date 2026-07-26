import { NextResponse } from "next/server";
import { withCache } from "@/lib/newsCache";
import type { GlobalMarketStats } from "@/lib/cryptoTypes";

export const dynamic = "force-dynamic";

// Same CoinGecko rate-limit reasoning as /api/crypto/rankings — cache
// aggressively, since this one dataset backs a single shared stats row
// used by every visitor to /crypto.
const CACHE_TTL_MS = 3 * 60_000;

interface GlobalStatsResponse {
  stats: GlobalMarketStats | null;
  generatedAt: string;
}

export async function GET() {
  const { stats, generatedAt } = await withCache(
    "crypto:global",
    CACHE_TTL_MS,
    async (): Promise<GlobalStatsResponse> => {
      const response = await fetch("https://api.coingecko.com/api/v3/global").catch(() => null);
      if (!response?.ok) return { stats: null, generatedAt: new Date().toISOString() };

      const body = await response.json().catch(() => null);
      const data = body?.data;
      if (!data) return { stats: null, generatedAt: new Date().toISOString() };

      const stats: GlobalMarketStats = {
        totalMarketCap: data.total_market_cap?.usd ?? 0,
        totalVolume: data.total_volume?.usd ?? 0,
        btcDominance: data.market_cap_percentage?.btc ?? 0,
        ethDominance: data.market_cap_percentage?.eth ?? 0,
        // CoinGecko's /global only exposes a 24h change figure for the
        // aggregate market cap — there's no equivalent for total volume
        // or for how BTC/ETH dominance itself has shifted, so those are
        // shown as point-in-time percentages with no change figure
        // rather than fabricating one.
        marketCapChangePercentage24h:
          typeof data.market_cap_change_percentage_24h_usd === "number"
            ? data.market_cap_change_percentage_24h_usd
            : null,
      };

      return { stats, generatedAt: new Date().toISOString() };
    }
  );

  return NextResponse.json({ stats, generatedAt });
}
