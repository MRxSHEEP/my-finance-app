"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import SparklineSlot from "@/components/SparklineSlot";
import { cardClass } from "@/lib/cardStyles";

export interface WatchlistCardData {
  symbol: string;
  // For crypto this is the coin's ticker (e.g. "BTC") for display —
  // `symbol` itself holds the CoinGecko id (e.g. "bitcoin") needed for
  // routing/re-fetching, which isn't presentable on its own.
  displaySymbol: string;
  name: string | null;
  assetType: "stock" | "crypto";
  price: number | null;
  change: number | null;
  percentChange: number | null;
  history: { time: number; value: number }[] | null;
  // Last-known-good history served because the live fetch failed — see
  // lib/stockHistoryCache.ts's own stale-fallback (stocks) and
  // lib/sparklineFetch.ts (the same pattern, used elsewhere for stocks).
  // Crypto items have no such fallback source yet, so this is always
  // false for them.
  stale: boolean;
}

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatChange(change: number): string {
  const formatted = currencyFormatter.format(Math.abs(change));
  return `${change >= 0 ? "+" : "-"}${formatted}`;
}

export function WatchlistCardSkeleton() {
  return (
    <div className={cardClass("neutral", { extra: "flex flex-col gap-3 p-4" })}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-1.5">
          <div className="h-4 w-20 animate-pulse rounded bg-foreground/10" />
          <div className="h-3 w-28 animate-pulse rounded bg-foreground/10" />
        </div>
        <div className="h-6 w-6 shrink-0 animate-pulse rounded-md bg-foreground/10" />
      </div>
      <div className="h-16 w-full animate-pulse rounded bg-foreground/10" />
      <div className="h-5 w-28 animate-pulse rounded bg-foreground/10" />
    </div>
  );
}

export function WatchlistCard({
  item,
  removing,
  onRemove,
}: {
  item: WatchlistCardData;
  removing: boolean;
  onRemove: () => void;
}) {
  // A fresh card starts hidden and fades/scales in on the next tick —
  // same technique as components/RevealOnScroll.tsx, just mount-
  // triggered instead of scroll-triggered. Sharing the same "settled"
  // class with `removing` below means enter and exit reuse one
  // transition instead of two separate animations.
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setEntered(true), 0);
    return () => clearTimeout(id);
  }, []);

  const hasQuote = item.price != null && item.change != null && item.percentChange != null;
  const isUp = hasQuote && item.percentChange! > 0;
  const isDown = hasQuote && item.percentChange! < 0;
  const settled = entered && !removing;

  return (
    <Link
      href={
        item.assetType === "crypto"
          ? `/crypto/${encodeURIComponent(item.symbol)}`
          : `/stocks?ticker=${encodeURIComponent(item.symbol)}`
      }
      className={cardClass("neutral", {
        interactive: true,
        extra: `flex flex-col gap-3 p-4 ${settled ? "scale-100 opacity-100" : "scale-95 opacity-0"}`,
      })}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold text-foreground">{item.displaySymbol}</h3>
          {item.name && <p className="text-xs text-foreground/50">{item.name}</p>}
        </div>
        <button
          type="button"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onRemove();
          }}
          aria-label={`Remove ${item.symbol} from watchlist`}
          className="flex h-10 w-10 items-center justify-center rounded-md border border-black/10 text-foreground/40 transition-all duration-200 ease-out hover:border-black/25 hover:text-foreground active:scale-90 dark:border-white/15 dark:hover:border-white/30"
        >
          <X size={14} />
        </button>
      </div>

      {/* Crypto keeps its chart — single-source CoinGecko history, out of
          scope for the stock period-mismatch fix below. Stocks get a
          same-height spacer instead of the chart, not a bare removal: a
          user's watchlist can mix both asset types in the same grid, and
          CSS Grid would otherwise stretch a chartless stock card to match
          a taller crypto neighbor in the same row, leaving dead space at
          the bottom instead of a cleanly-sized card. */}
      {item.assetType === "crypto" ? (
        <div className="h-16 w-full">
          <SparklineSlot history={item.history} stale={item.stale} height={64} />
        </div>
      ) : (
        <div className="h-16 w-full" aria-hidden="true" />
      )}

      <div className="flex flex-col gap-0.5">
        <div className="flex items-center gap-1.5">
          <span className="text-lg font-semibold text-foreground">
            {hasQuote ? currencyFormatter.format(item.price!) : "—"}
          </span>
          {item.assetType === "stock" && item.stale && (
            <span
              className="rounded-sm bg-foreground/10 px-1 py-px text-[8px] font-medium uppercase leading-none tracking-wide text-foreground/50"
              title="Showing the last available price — live data is temporarily unavailable"
            >
              Stale
            </span>
          )}
        </div>
        {hasQuote && (
          <span
            className={`text-xs font-medium ${
              isUp ? "text-green-500" : isDown ? "text-red-500" : "text-foreground/50"
            }`}
          >
            {isUp ? "▲" : isDown ? "▼" : ""} {formatChange(item.change!)} (
            {item.percentChange! >= 0 ? "+" : ""}
            {item.percentChange!.toFixed(2)}%)
          </span>
        )}
      </div>
    </Link>
  );
}
