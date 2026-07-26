"use client";

import { Globe } from "lucide-react";
import RevealOnScroll from "@/components/RevealOnScroll";
import { cardClass } from "@/lib/cardStyles";
import type { GlobalMarketStats as GlobalMarketStatsData } from "@/lib/cryptoTypes";

const compactCurrencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 2,
});

function formatPercent(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function formatUpdatedAgo(generatedAt: string | null): string | null {
  if (!generatedAt) return null;
  const fetchedMs = new Date(generatedAt).getTime();
  if (Number.isNaN(fetchedMs)) return null;

  const diffSec = Math.max(0, Math.floor((Date.now() - fetchedMs) / 1000));
  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? "" : "s"} ago`;
  const diffHour = Math.floor(diffMin / 60);
  return `${diffHour} hour${diffHour === 1 ? "" : "s"} ago`;
}

interface StatTileProps {
  label: string;
  value: string;
  changePercent?: number | null;
}

function StatTile({ label, value, changePercent }: StatTileProps) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-foreground/50">{label}</span>
      <span className="text-lg font-semibold text-foreground">{value}</span>
      {changePercent != null && (
        <span className={`text-xs font-medium ${changePercent >= 0 ? "text-green-500" : "text-red-500"}`}>
          {changePercent >= 0 ? "▲" : "▼"} {formatPercent(changePercent)}{" "}
          <span className="text-foreground/40">24h</span>
        </span>
      )}
    </div>
  );
}

interface GlobalMarketStatsProps {
  stats: GlobalMarketStatsData | null;
  error: string | null;
  generatedAt: string | null;
}

export default function GlobalMarketStats({ stats, error, generatedAt }: GlobalMarketStatsProps) {
  const updatedAgo = formatUpdatedAgo(generatedAt);

  return (
    <RevealOnScroll className="flex w-full flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Globe size={20} className="text-indigo-400" />
          <h2 className="text-xl font-bold text-foreground">Market Overview</h2>
        </div>
        {updatedAgo && (
          <span className="text-xs text-foreground/40">
            Updated {updatedAgo} · Prices from CoinGecko
          </span>
        )}
      </div>

      {error && !stats && <p className="text-sm text-red-500">{error}</p>}

      {!stats && !error && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 w-full animate-pulse rounded-md bg-foreground/10" />
          ))}
        </div>
      )}

      {stats && (
        <div className={cardClass("neutral", { extra: "grid grid-cols-2 gap-4 p-4 sm:grid-cols-4" })}>
          <StatTile
            label="Total Market Cap"
            value={compactCurrencyFormatter.format(stats.totalMarketCap)}
            changePercent={stats.marketCapChangePercentage24h}
          />
          <StatTile label="24h Volume" value={compactCurrencyFormatter.format(stats.totalVolume)} />
          <StatTile label="BTC Dominance" value={`${stats.btcDominance.toFixed(1)}%`} />
          <StatTile label="ETH Dominance" value={`${stats.ethDominance.toFixed(1)}%`} />
        </div>
      )}
    </RevealOnScroll>
  );
}
