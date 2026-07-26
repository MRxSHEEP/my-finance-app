"use client";

import Link from "next/link";
import { WatchlistCard, WatchlistCardSkeleton } from "@/components/WatchlistCard";
import { useWatchlistItems } from "@/lib/useWatchlist";

export default function WatchlistPage() {
  const { status, items, error, removingSymbols, remove } = useWatchlistItems();

  if (status === "loading") {
    return (
      <main className="flex flex-1 flex-col items-center gap-6 p-8 pt-16">
        <h1 className="text-3xl font-bold text-foreground">Watchlist</h1>
      </main>
    );
  }

  if (status !== "authenticated") {
    return (
      <main className="flex flex-1 flex-col items-center gap-4 p-8 pt-16 text-center">
        <h1 className="text-3xl font-bold text-foreground">Watchlist</h1>
        <p className="text-foreground/60">Sign in to save tickers and track them here.</p>
        <Link
          href="/login"
          className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90"
        >
          Sign In
        </Link>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col items-center gap-6 p-8 pt-16">
      <h1 className="text-3xl font-bold text-foreground">Watchlist</h1>

      <div className="grid w-full max-w-5xl grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items === null &&
          !error &&
          Array.from({ length: 3 }).map((_, i) => <WatchlistCardSkeleton key={i} />)}

        {error && <p className="col-span-full text-sm text-red-500">{error}</p>}

        {items !== null && items.length === 0 && !error && (
          <p className="col-span-full text-sm text-foreground/60">
            No tickers saved yet — star a stock from the stocks page to add it here.
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
    </main>
  );
}
