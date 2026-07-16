"use client";

import { useEffect, useState } from "react";
import { PercentChangeBadge } from "@/components/PriceChart";
import RevealOnScroll from "@/components/RevealOnScroll";

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

const MOVERS_COUNT = 8;

// Decimal precision scales with price magnitude, same reasoning as the
// coin grid above — a fixed 2 decimals would round sub-cent altcoin
// prices away to nothing.
function decimalsForPrice(price: number): number {
  if (price >= 100) return 2;
  if (price >= 1) return 3;
  if (price >= 0.01) return 4;
  return 6;
}

function formatPrice(price: number): string {
  const decimals = decimalsForPrice(price);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(price);
}

const compactCurrencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 2,
});

type SortKey = "rank" | "name" | "price" | "change" | "marketCap" | "volume";
type SortDir = "asc" | "desc";

const DEFAULT_DIR: Record<SortKey, SortDir> = {
  rank: "asc",
  name: "asc",
  price: "desc",
  change: "desc",
  marketCap: "desc",
  volume: "desc",
};

const COLUMNS: Array<{ key: SortKey; label: string; align: "left" | "right" }> = [
  { key: "rank", label: "#", align: "left" },
  { key: "name", label: "Name", align: "left" },
  { key: "price", label: "Price", align: "right" },
  { key: "change", label: "24h", align: "right" },
  { key: "marketCap", label: "Market Cap", align: "right" },
  { key: "volume", label: "Volume", align: "right" },
];

function sortValue(coin: CoinRanking, key: SortKey): number | string {
  switch (key) {
    case "rank":
      return coin.marketCapRank ?? Number.MAX_SAFE_INTEGER;
    case "name":
      return coin.name.toLowerCase();
    case "price":
      return coin.currentPrice;
    case "change":
      return coin.percentChange24h ?? -Infinity;
    case "marketCap":
      return coin.marketCap;
    case "volume":
      return coin.totalVolume;
  }
}

function SortHeader({
  column,
  sortKey,
  sortDir,
  onSort,
}: {
  column: (typeof COLUMNS)[number];
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (key: SortKey) => void;
}) {
  const active = column.key === sortKey;
  return (
    <th className={`p-2 text-xs font-medium text-foreground/50 ${column.align === "right" ? "text-right" : "text-left"}`}>
      <button
        type="button"
        onClick={() => onSort(column.key)}
        className={`inline-flex items-center gap-1 hover:text-foreground ${
          column.align === "right" ? "flex-row-reverse" : ""
        } ${active ? "text-foreground" : ""}`}
      >
        {column.label}
        {active && <span className="text-[10px]">{sortDir === "asc" ? "▲" : "▼"}</span>}
      </button>
    </th>
  );
}

function RankingsTable({ coins }: { coins: CoinRanking[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("rank");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(DEFAULT_DIR[key]);
    }
  }

  const sorted = [...coins].sort((a, b) => {
    const va = sortValue(a, sortKey);
    const vb = sortValue(b, sortKey);
    const cmp =
      typeof va === "string" && typeof vb === "string" ? va.localeCompare(vb) : (va as number) - (vb as number);
    return sortDir === "asc" ? cmp : -cmp;
  });

  return (
    <div className="overflow-x-auto rounded-md border border-black/10 dark:border-white/15">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-black/10 dark:border-white/15">
            {COLUMNS.map((column) => (
              <SortHeader key={column.key} column={column} sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((coin) => (
            <tr key={coin.id} className="border-t border-black/5 dark:border-white/10">
              <td className="p-2 text-foreground/60">{coin.marketCapRank ?? "—"}</td>
              <td className="p-2">
                <span className="font-medium text-foreground">{coin.name}</span>{" "}
                <span className="text-foreground/50">{coin.symbol.toUpperCase()}</span>
              </td>
              <td className="p-2 text-right text-foreground">{formatPrice(coin.currentPrice)}</td>
              <td className="p-2 text-right">
                {coin.percentChange24h !== null ? (
                  <PercentChangeBadge value={coin.percentChange24h} />
                ) : (
                  <span className="text-foreground/50">—</span>
                )}
              </td>
              <td className="p-2 text-right text-foreground">{compactCurrencyFormatter.format(coin.marketCap)}</td>
              <td className="p-2 text-right text-foreground">{compactCurrencyFormatter.format(coin.totalVolume)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MoverRow({ coin }: { coin: CoinRanking }) {
  const change = coin.percentChange24h ?? 0;
  const isUp = change > 0;
  return (
    <li className="flex items-center justify-between gap-3 rounded-md border border-black/10 px-3 py-2 dark:border-white/15">
      <div className="flex flex-col">
        <span className="text-sm font-medium text-foreground">{coin.name}</span>
        <span className="text-xs text-foreground/50">{coin.symbol.toUpperCase()}</span>
      </div>
      <div className="flex flex-col items-end">
        <span className="text-sm font-medium text-foreground">{formatPrice(coin.currentPrice)}</span>
        <span className={`text-xs font-medium ${isUp ? "text-green-500" : "text-red-500"}`}>
          {isUp ? "▲" : "▼"} {Math.abs(change).toFixed(2)}%
        </span>
      </div>
    </li>
  );
}

function TopMovers({ coins }: { coins: CoinRanking[] }) {
  const withChange = coins.filter(
    (coin): coin is CoinRanking & { percentChange24h: number } => coin.percentChange24h !== null
  );
  const gainers = [...withChange].sort((a, b) => b.percentChange24h - a.percentChange24h).slice(0, MOVERS_COUNT);
  const losers = [...withChange].sort((a, b) => a.percentChange24h - b.percentChange24h).slice(0, MOVERS_COUNT);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-foreground/70">Top Gainers (24h)</h3>
        <ul className="flex flex-col gap-2">
          {gainers.map((coin) => (
            <MoverRow key={coin.id} coin={coin} />
          ))}
        </ul>
      </div>
      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-foreground/70">Top Losers (24h)</h3>
        <ul className="flex flex-col gap-2">
          {losers.map((coin) => (
            <MoverRow key={coin.id} coin={coin} />
          ))}
        </ul>
      </div>
    </div>
  );
}

function SkeletonBlock() {
  return <div className="h-64 w-full animate-pulse rounded-md bg-foreground/10" />;
}

// Fetches the rankings dataset once and derives both sections from it —
// Top Movers is just the same 50 coins re-sorted by 24h change, so a
// second upstream call would be redundant against CoinGecko's already
// tight rate limit (see the /api/crypto/rankings route).
export default function MarketOverview() {
  const [coins, setCoins] = useState<CoinRanking[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch("/api/crypto/rankings");
        if (!response.ok) throw new Error("request failed");
        const body = await response.json();
        if (cancelled) return;
        const list: CoinRanking[] = Array.isArray(body?.coins) ? body.coins : [];
        setCoins(list);
        if (list.length === 0) setError("No ranking data available.");
      } catch {
        if (!cancelled) setError("Failed to load market rankings.");
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <RevealOnScroll className="flex w-full flex-col gap-4">
        <h2 className="text-xl font-bold text-foreground">Top Movers</h2>
        {coins === null && !error && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <SkeletonBlock />
            <SkeletonBlock />
          </div>
        )}
        {error && coins === null && <p className="text-sm text-red-500">{error}</p>}
        {coins && coins.length > 0 && <TopMovers coins={coins} />}
      </RevealOnScroll>

      <RevealOnScroll className="flex w-full flex-col gap-4">
        <h2 className="text-xl font-bold text-foreground">Market Cap Rankings</h2>
        {coins === null && !error && <SkeletonBlock />}
        {error && coins === null && <p className="text-sm text-red-500">{error}</p>}
        {coins && coins.length > 0 && <RankingsTable coins={coins} />}
      </RevealOnScroll>
    </>
  );
}
