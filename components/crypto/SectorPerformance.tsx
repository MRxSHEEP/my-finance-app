"use client";

import { Bitcoin } from "lucide-react";
import RevealOnScroll from "@/components/RevealOnScroll";
import { PercentChangeBadge } from "@/components/PriceChart";
import { cardClass } from "@/lib/cardStyles";
import { isStablecoin, matchesCategory, passesLiquidityFloor } from "@/lib/cryptoCategories";
import type { CoinRanking, GlobalMarketStats } from "@/lib/cryptoTypes";

// "Sector" here means an actual market segment (DeFi, Layer 1, AI, Meme)
// — deliberately excludes "large-cap"/"all" from lib/cryptoCategories.ts's
// CryptoCategory union, since those are market-cap bands, not sectors,
// and a "performance breakdown by sector" reading "All Coins: +1.2%"
// would just restate the global market stats shown earlier on the page.
const SECTORS: Array<{ key: "defi" | "layer-1" | "ai" | "meme"; label: string }> = [
  { key: "defi", label: "DeFi" },
  { key: "layer-1", label: "Layer 1" },
  { key: "ai", label: "AI" },
  { key: "meme", label: "Meme" },
];

const compactCurrencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 2,
});

interface SectorStats {
  key: string;
  label: string;
  coinCount: number;
  totalMarketCap: number;
  // Market-cap-weighted, not a simple average — otherwise one tiny,
  // thinly-traded coin swinging 40% would dominate the sector's reported
  // performance as much as the sector's largest constituent.
  weightedChange24h: number | null;
  weightedChange7d: number | null;
}

function weightedAverage(coins: CoinRanking[], pick: (coin: CoinRanking) => number | null): number | null {
  let weightedSum = 0;
  let totalWeight = 0;
  for (const coin of coins) {
    const value = pick(coin);
    if (value === null) continue;
    weightedSum += value * coin.marketCap;
    totalWeight += coin.marketCap;
  }
  return totalWeight > 0 ? weightedSum / totalWeight : null;
}

function computeSectorStats(coins: CoinRanking[]): SectorStats[] {
  // Same liquidity floor + stablecoin exclusion as Top Movers (Phase 3) —
  // a sector's "performance" shouldn't be muddied by illiquid coins or by
  // stablecoins that structurally can't move.
  const eligible = coins.filter((coin) => passesLiquidityFloor(coin) && !isStablecoin(coin.id));

  return SECTORS.map(({ key, label }) => {
    const sectorCoins = eligible.filter((coin) => matchesCategory(coin, key));
    return {
      key,
      label,
      coinCount: sectorCoins.length,
      totalMarketCap: sectorCoins.reduce((sum, coin) => sum + coin.marketCap, 0),
      weightedChange24h: weightedAverage(sectorCoins, (coin) => coin.percentChange24h),
      weightedChange7d: weightedAverage(sectorCoins, (coin) => coin.percentChange7d),
    };
  });
}

interface SectorPerformanceProps {
  coins: CoinRanking[] | null;
  globalStats: GlobalMarketStats | null;
  error: string | null;
}

export default function SectorPerformance({ coins, globalStats, error }: SectorPerformanceProps) {
  const sectors = coins ? computeSectorStats(coins) : null;

  return (
    <RevealOnScroll className="flex w-full flex-col gap-4">
      <h2 className="text-xl font-bold text-foreground">Crypto Sector Performance</h2>

      {error && !coins && <p className="text-sm text-red-500">{error}</p>}

      {!coins && !error && <div className="h-40 w-full animate-pulse rounded-md bg-foreground/10" />}

      {coins && (
        <div className="flex flex-col gap-4">
          {globalStats && (
            <div className={cardClass("neutral", { extra: "flex items-center gap-3 p-4" })}>
              <Bitcoin size={20} className="text-amber-400" />
              <div>
                <span className="block text-xs text-foreground/50">Bitcoin Dominance</span>
                <span className="text-lg font-semibold text-foreground">{globalStats.btcDominance.toFixed(1)}%</span>
              </div>
              <div className="ml-4 border-l border-black/10 pl-4 dark:border-white/15">
                <span className="block text-xs text-foreground/50">Ethereum Dominance</span>
                <span className="text-lg font-semibold text-foreground">{globalStats.ethDominance.toFixed(1)}%</span>
              </div>
            </div>
          )}

          <div className="overflow-x-auto rounded-md border border-black/10 dark:border-white/15">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b border-black/10 dark:border-white/15">
                  <th className="p-2 text-left text-xs font-medium text-foreground/50">Sector</th>
                  <th className="p-2 text-right text-xs font-medium text-foreground/50">Coins</th>
                  <th className="p-2 text-right text-xs font-medium text-foreground/50">Market Cap</th>
                  <th className="p-2 text-right text-xs font-medium text-foreground/50">24h</th>
                  <th className="p-2 text-right text-xs font-medium text-foreground/50">7d</th>
                </tr>
              </thead>
              <tbody>
                {sectors?.map((sector) => (
                  <tr key={sector.key} className="border-t border-black/5 dark:border-white/10">
                    <td className="p-2 font-medium text-foreground">{sector.label}</td>
                    <td className="p-2 text-right text-foreground/60">{sector.coinCount}</td>
                    <td className="p-2 text-right text-foreground">
                      {sector.coinCount > 0 ? compactCurrencyFormatter.format(sector.totalMarketCap) : "—"}
                    </td>
                    <td className="p-2 text-right">
                      {sector.weightedChange24h !== null ? (
                        <PercentChangeBadge value={sector.weightedChange24h} />
                      ) : (
                        <span className="text-foreground/50">—</span>
                      )}
                    </td>
                    <td className="p-2 text-right">
                      {sector.weightedChange7d !== null ? (
                        <PercentChangeBadge value={sector.weightedChange7d} />
                      ) : (
                        <span className="text-foreground/50">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-foreground/40">
            Sector performance is market-cap-weighted across coins in the top {coins.length} by market cap that meet
            the same liquidity threshold as Top Movers — thin or newly-listed coins in a sector won&apos;t skew its
            reported performance.
          </p>
        </div>
      )}
    </RevealOnScroll>
  );
}
