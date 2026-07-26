"use client";

import Link from "next/link";
import { Star } from "lucide-react";
import RevealOnScroll from "@/components/RevealOnScroll";
import { WatchlistCard, WatchlistCardSkeleton } from "@/components/WatchlistCard";
import { useWatchlistItems } from "@/lib/useWatchlist";

export default function EmbeddedWatchlistSection() {
  const { status, items, error, removingSymbols, remove } = useWatchlistItems();

  return (
    <RevealOnScroll className="flex w-full flex-col gap-4">
      <div>
        <div className="flex items-center gap-2">
          <Star size={20} className="text-amber-400" />
          <h2 className="text-xl font-bold text-foreground">Watchlist</h2>
        </div>
        <p className="text-sm text-foreground/50">Tickers you&apos;re keeping an eye on</p>
      </div>

      {status !== "loading" && status !== "authenticated" && (
        <div className="flex flex-col items-center gap-3 rounded-md border border-black/10 p-8 text-center dark:border-white/15">
          <p className="text-sm text-foreground/60">Sign in to build your watchlist.</p>
          <Link
            href="/login"
            className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90"
          >
            Sign In
          </Link>
        </div>
      )}

      {status === "authenticated" && (
        <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {items === null &&
            !error &&
            Array.from({ length: 4 }).map((_, i) => <WatchlistCardSkeleton key={i} />)}

          {error && <p className="col-span-full text-sm text-red-500">{error}</p>}

          {items !== null && items.length === 0 && !error && (
            <p className="col-span-full text-sm text-foreground/60">
              No tickers saved yet — star a stock above to add it here.
            </p>
          )}

          {items?.map((item) => (
            <WatchlistCard
              key={item.symbol}
              item={item}
              removing={removingSymbols.has(item.symbol)}
              onRemove={() => remove(item.symbol)}
            />
          ))}
        </div>
      )}
    </RevealOnScroll>
  );
}
