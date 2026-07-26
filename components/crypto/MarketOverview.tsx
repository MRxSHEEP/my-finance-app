"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PercentChangeBadge } from "@/components/PriceChart";
import RevealOnScroll from "@/components/RevealOnScroll";
import Sparkline from "@/components/Sparkline";
import PaginationControls from "@/components/Pagination";
import ScrollHint from "@/components/ScrollHint";
import type { CoinRanking } from "@/lib/cryptoTypes";
import { SCROLLBAR_THIN_CLASS } from "@/lib/scrollbarStyles";
import {
  CATEGORY_TABS,
  isStablecoin,
  matchesCategory,
  passesLiquidityFloor,
  type CryptoCategory,
} from "@/lib/cryptoCategories";

const TABLE_PAGE_SIZE = 15;

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

const compactFormatter = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 2,
});

type SortKey =
  | "rank"
  | "name"
  | "price"
  | "change1h"
  | "change24h"
  | "change7d"
  | "marketCap"
  | "volume"
  | "circulatingSupply";
type SortDir = "asc" | "desc";

const DEFAULT_DIR: Record<SortKey, SortDir> = {
  rank: "asc",
  name: "asc",
  price: "desc",
  change1h: "desc",
  change24h: "desc",
  change7d: "desc",
  marketCap: "desc",
  volume: "desc",
  circulatingSupply: "desc",
};

const COLUMNS: Array<{ key: SortKey; label: string; align: "left" | "right" }> = [
  { key: "rank", label: "#", align: "left" },
  { key: "name", label: "Name", align: "left" },
  { key: "price", label: "Price", align: "right" },
  { key: "change1h", label: "1h", align: "right" },
  { key: "change24h", label: "24h", align: "right" },
  { key: "change7d", label: "7d", align: "right" },
  { key: "marketCap", label: "Market Cap", align: "right" },
  { key: "volume", label: "Volume", align: "right" },
  { key: "circulatingSupply", label: "Circulating Supply", align: "right" },
];

function sortValue(coin: CoinRanking, key: SortKey): number | string {
  switch (key) {
    case "rank":
      return coin.marketCapRank ?? Number.MAX_SAFE_INTEGER;
    case "name":
      return coin.name.toLowerCase();
    case "price":
      return coin.currentPrice;
    case "change1h":
      return coin.percentChange1h ?? -Infinity;
    case "change24h":
      return coin.percentChange24h ?? -Infinity;
    case "change7d":
      return coin.percentChange7d ?? -Infinity;
    case "marketCap":
      return coin.marketCap;
    case "volume":
      return coin.totalVolume;
    case "circulatingSupply":
      return coin.circulatingSupply ?? -Infinity;
  }
}

function SortHeader({
  column,
  sortKey,
  sortDir,
  onSort,
  sticky = false,
}: {
  column: (typeof COLUMNS)[number];
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (key: SortKey) => void;
  sticky?: boolean;
}) {
  const active = column.key === sortKey;
  return (
    <th
      className={`p-2 text-xs font-medium text-foreground/50 ${column.align === "right" ? "text-right" : "text-left"} ${
        sticky ? "sticky top-0 z-10 bg-background" : ""
      }`}
    >
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

function ChangeCell({ value }: { value: number | null }) {
  if (value === null) return <span className="text-foreground/50">—</span>;
  return <PercentChangeBadge value={value} />;
}

export function RankingsTable({ coins, limit }: { coins: CoinRanking[]; limit?: number }) {
  const [sortKey, setSortKey] = useState<SortKey>("rank");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<CryptoCategory>("all");
  const pageSize = limit ?? TABLE_PAGE_SIZE;
  const [page, setPage] = useState(1);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // A changed search/category invalidates whatever page was previously
  // shown — starting back at page 1 avoids landing on a now-out-of-range
  // page under a brand new filter. Reset during render (React's documented
  // pattern for "adjusting state when inputs change") rather than in an
  // effect, which would cost an extra render.
  const filterKey = `${search}|${category}`;
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
  if (filterKey !== prevFilterKey) {
    setPrevFilterKey(filterKey);
    setPage(1);
  }

  // A `limit` (the homepage preview) caps the pool to the top N coins by
  // market-cap rank before any search/category filtering or sorting is
  // applied — "top 20 by market cap", not "however many happen to sort
  // first" — and disables pagination entirely (page size equals the whole
  // capped pool, so there's only ever one page); seeing more than the
  // capped preview is what the "View all" link is for.
  const pool = useMemo(() => {
    if (!limit) return coins;
    return [...coins]
      .sort((a, b) => (a.marketCapRank ?? Number.MAX_SAFE_INTEGER) - (b.marketCapRank ?? Number.MAX_SAFE_INTEGER))
      .slice(0, limit);
  }, [coins, limit]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return pool.filter((coin) => {
      if (!matchesCategory(coin, category)) return false;
      if (!query) return true;
      return coin.name.toLowerCase().includes(query) || coin.symbol.toLowerCase().includes(query);
    });
  }, [pool, search, category]);

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(DEFAULT_DIR[key]);
    }
  }

  const sorted = [...filtered].sort((a, b) => {
    const va = sortValue(a, sortKey);
    const vb = sortValue(b, sortKey);
    const cmp =
      typeof va === "string" && typeof vb === "string" ? va.localeCompare(vb) : (va as number) - (vb as number);
    return sortDir === "asc" ? cmp : -cmp;
  });

  const totalPages = limit ? 1 : Math.max(1, Math.ceil(sorted.length / TABLE_PAGE_SIZE));
  const visible = sorted.slice((page - 1) * pageSize, page * pageSize);

  // Replaces the row set outright (page-based) rather than appending to it
  // (the old "Load more" behavior), so the table never grows unbounded —
  // and scrolls the table's own internal scroll container (not the whole
  // page) back to its top, since that's the part that actually scrolls.
  function handlePageChange(nextPage: number) {
    setPage(Math.min(Math.max(nextPage, 1), totalPages));
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by name or symbol"
          className="w-full max-w-xs rounded-md border border-black/10 bg-transparent px-3 py-1.5 text-sm outline-none focus:border-black/30 dark:border-white/15 dark:focus:border-white/30"
        />
        <CategoryTabs selected={category} onSelect={setCategory} />
      </div>

      {sorted.length === 0 ? (
        <p className="text-sm text-foreground/50">No coins match this search/category.</p>
      ) : (
        <>
        <ScrollHint />
        <div className="overflow-x-auto rounded-md border border-black/10 dark:border-white/15">
          <div ref={scrollContainerRef} className={`max-h-[600px] overflow-y-auto ${SCROLLBAR_THIN_CLASS}`}>
            <table className="w-full min-w-[1040px] text-sm">
              <thead>
                <tr className="border-b border-black/10 bg-background dark:border-white/15">
                  {COLUMNS.map((column) => (
                    <SortHeader
                      key={column.key}
                      column={column}
                      sortKey={sortKey}
                      sortDir={sortDir}
                      onSort={handleSort}
                      sticky
                    />
                  ))}
                  <th className="sticky top-0 z-10 bg-background p-2 text-right text-xs font-medium text-foreground/50">
                    7d Trend
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.map((coin) => (
                  <RankingsRow key={coin.id} coin={coin} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
        </>
      )}

      {!limit && sorted.length > 0 && (
        <PaginationControls page={page} totalPages={totalPages} onPageChange={handlePageChange} />
      )}
    </div>
  );
}

function RankingsRow({ coin }: { coin: CoinRanking }) {
  const router = useRouter();

  return (
    <tr
      onClick={() => router.push(`/crypto/${coin.id}`)}
      className="cursor-pointer border-t border-black/5 transition-colors hover:bg-foreground/5 dark:border-white/10"
    >
      <td className="p-2 text-foreground/60">{coin.marketCapRank ?? "—"}</td>
      <td className="p-2">
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={coin.image}
            alt=""
            className="h-5 w-5 shrink-0 rounded-full bg-white object-contain"
            onError={(event) => {
              event.currentTarget.style.display = "none";
            }}
          />
          <span className="font-medium text-foreground">{coin.name}</span>
          <span className="text-foreground/50">{coin.symbol.toUpperCase()}</span>
        </div>
      </td>
      <td className="p-2 text-right text-foreground">{formatPrice(coin.currentPrice)}</td>
      <td className="p-2 text-right">
        <ChangeCell value={coin.percentChange1h} />
      </td>
      <td className="p-2 text-right">
        <ChangeCell value={coin.percentChange24h} />
      </td>
      <td className="p-2 text-right">
        <ChangeCell value={coin.percentChange7d} />
      </td>
      <td className="p-2 text-right text-foreground">{compactCurrencyFormatter.format(coin.marketCap)}</td>
      <td className="p-2 text-right text-foreground">{compactCurrencyFormatter.format(coin.totalVolume)}</td>
      <td className="p-2 text-right text-foreground">
        {coin.circulatingSupply !== null ? compactFormatter.format(coin.circulatingSupply) : "—"}
      </td>
      <td className="p-2">
        {coin.sparkline7d && coin.sparkline7d.length > 1 ? (
          <div className="ml-auto w-24">
            <Sparkline values={coin.sparkline7d} width={96} height={28} />
          </div>
        ) : (
          <span className="block text-right text-foreground/50">—</span>
        )}
      </td>
    </tr>
  );
}

function MoverRow({ coin }: { coin: CoinRanking }) {
  const change = coin.percentChange24h ?? 0;
  const isUp = change > 0;
  return (
    <li>
      <Link
        href={`/crypto/${coin.id}`}
        className="flex items-center justify-between gap-3 rounded-md border border-black/10 px-3 py-2 transition-colors hover:bg-foreground/5 dark:border-white/15"
      >
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
      </Link>
    </li>
  );
}

function TopMovers({ coins }: { coins: CoinRanking[] }) {
  const withChange = coins.filter(
    (coin): coin is CoinRanking & { percentChange24h: number } => coin.percentChange24h !== null
  );
  const gainers = [...withChange].sort((a, b) => b.percentChange24h - a.percentChange24h).slice(0, MOVERS_COUNT);
  const losers = [...withChange].sort((a, b) => a.percentChange24h - b.percentChange24h).slice(0, MOVERS_COUNT);

  if (withChange.length === 0) {
    return <p className="text-sm text-foreground/50">No coins in this category meet the liquidity threshold right now.</p>;
  }

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

function CategoryTabs({
  selected,
  onSelect,
}: {
  selected: CryptoCategory;
  onSelect: (category: CryptoCategory) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {CATEGORY_TABS.map((tab) => {
        const active = tab.key === selected;
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onSelect(tab.key)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              active
                ? "border-purple-400/50 bg-purple-500/15 text-purple-300"
                : "border-black/10 text-foreground/60 hover:text-foreground dark:border-white/15"
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

function SkeletonBlock() {
  return <div className="h-64 w-full animate-pulse rounded-md bg-foreground/10" />;
}

interface MarketOverviewProps {
  coins: CoinRanking[] | null;
  error: string | null;
}

// Coins/error come from the CryptoPage parent — a single shared fetch of
// /api/crypto/rankings backs this section, the Top 8 grid, and (for a
// matching coin) the search hero's own overview stats, so every section
// agrees on the same price for the same coin at the same moment instead
// of each one racing CoinGecko's tight rate limit independently.
//
// Split into two standalone sections (rather than one bundled component)
// so the parent page can place the Top 8 "most-traded" grid between them,
// per the page's requested section order — Top Movers, then Trending/
// most-traded, then the rankings table.
export function TopMoversSection({ coins, error }: MarketOverviewProps) {
  const [moversCategory, setMoversCategory] = useState<CryptoCategory>("all");

  // Liquidity floor + stablecoin exclusion apply regardless of category so
  // thin/illiquid coins never masquerade as "top movers"; the selected tab
  // narrows further by market segment. See lib/cryptoCategories.ts for why
  // these specific thresholds and the exchange-listing rationale.
  const eligibleMovers = useMemo(() => {
    if (!coins) return [];
    return coins.filter((coin) => passesLiquidityFloor(coin) && !isStablecoin(coin.id));
  }, [coins]);

  const categorizedMovers = useMemo(
    () => eligibleMovers.filter((coin) => matchesCategory(coin, moversCategory)),
    [eligibleMovers, moversCategory]
  );

  return (
    <RevealOnScroll className="flex w-full flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-foreground">Top Movers</h2>
        {coins && coins.length > 0 && <CategoryTabs selected={moversCategory} onSelect={setMoversCategory} />}
      </div>
      {coins === null && !error && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SkeletonBlock />
          <SkeletonBlock />
        </div>
      )}
      {error && coins === null && <p className="text-sm text-red-500">{error}</p>}
      {coins && coins.length > 0 && <TopMovers coins={categorizedMovers} />}
    </RevealOnScroll>
  );
}

// The homepage previews only the top 20 by market cap (RankingsTable's
// `limit` prop) — showing all 100 here made the page far too long. The
// full sortable/searchable list lives at its own route so expanding it
// doesn't push the rest of the homepage down.
const HOMEPAGE_PREVIEW_LIMIT = 20;

export function RankingsSection({ coins, error }: MarketOverviewProps) {
  return (
    <RevealOnScroll className="flex w-full flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-bold text-foreground">Market Cap Rankings</h2>
        {coins && coins.length > 0 && (
          <Link
            href="/crypto/rankings"
            className="text-sm font-medium text-foreground/60 transition-colors hover:text-foreground"
          >
            View all {coins.length} →
          </Link>
        )}
      </div>
      {coins === null && !error && <SkeletonBlock />}
      {error && coins === null && <p className="text-sm text-red-500">{error}</p>}
      {coins && coins.length > 0 && <RankingsTable coins={coins} limit={HOMEPAGE_PREVIEW_LIMIT} />}
    </RevealOnScroll>
  );
}
