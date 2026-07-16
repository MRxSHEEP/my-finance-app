"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { X } from "lucide-react";
import MiniLineChart from "@/components/MiniLineChart";

const CARD_EXIT_DURATION_MS = 300;

interface WatchlistCardData {
  symbol: string;
  name: string | null;
  price: number | null;
  change: number | null;
  percentChange: number | null;
  history: { time: number; value: number }[] | null;
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

// ---------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------

function WatchlistCardSkeleton() {
  return (
    <div className="flex flex-col gap-3 rounded-md border border-black/10 p-4 dark:border-white/15">
      <div className="flex flex-col gap-1.5">
        <div className="h-4 w-20 animate-pulse rounded bg-foreground/10" />
        <div className="h-3 w-28 animate-pulse rounded bg-foreground/10" />
      </div>
      <div className="h-16 w-full animate-pulse rounded bg-foreground/10" />
      <div className="h-5 w-28 animate-pulse rounded bg-foreground/10" />
    </div>
  );
}

function WatchlistCard({
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
    <div
      className={`flex flex-col gap-3 rounded-md border border-black/10 p-4 transition-all duration-300 ease-out dark:border-white/15 ${
        settled ? "scale-100 opacity-100" : "scale-95 opacity-0"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold text-foreground">{item.symbol}</h3>
          {item.name && <p className="text-xs text-foreground/50">{item.name}</p>}
        </div>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${item.symbol} from watchlist`}
          className="rounded-md border border-black/10 p-1 text-foreground/40 transition-colors hover:text-foreground dark:border-white/15"
        >
          <X size={14} />
        </button>
      </div>

      <div className="h-16 w-full">
        {item.history && item.history.length > 0 ? (
          <MiniLineChart data={item.history} height={64} />
        ) : (
          <div className="h-full w-full animate-pulse rounded bg-foreground/10" />
        )}
      </div>

      <div className="flex flex-col gap-0.5">
        <span className="text-lg font-semibold text-foreground">
          {hasQuote ? currencyFormatter.format(item.price!) : "—"}
        </span>
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
    </div>
  );
}

// ---------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------

export default function WatchlistPage() {
  const { status } = useSession();
  const [items, setItems] = useState<WatchlistCardData[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [removingSymbols, setRemovingSymbols] = useState<Set<string>>(new Set());
  const removalTimeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    const timeouts = removalTimeoutsRef.current;
    return () => {
      timeouts.forEach((id) => clearTimeout(id));
    };
  }, []);

  useEffect(() => {
    if (status !== "authenticated") return;
    let cancelled = false;

    async function load() {
      try {
        const listResponse = await fetch("/api/watchlist");
        const listBody = await listResponse.json().catch(() => null);

        if (!listResponse.ok || cancelled) {
          if (!cancelled) setError("Failed to load your watchlist");
          return;
        }

        const rawItems: Array<{ symbol: string; name: string | null }> = Array.isArray(
          listBody.items
        )
          ? listBody.items
          : [];

        const enriched = await Promise.all(
          rawItems.map(async (raw) => {
            const [quoteResponse, historyResponse] = await Promise.all([
              fetch(`/api/stock?ticker=${encodeURIComponent(raw.symbol)}`).catch(() => null),
              fetch(
                `/api/stock/history?ticker=${encodeURIComponent(raw.symbol)}&range=1M&interval=1day`
              ).catch(() => null),
            ]);

            const quote =
              quoteResponse && quoteResponse.ok ? await quoteResponse.json().catch(() => null) : null;
            const historyBody =
              historyResponse && historyResponse.ok
                ? await historyResponse.json().catch(() => null)
                : null;

            const history: WatchlistCardData["history"] = Array.isArray(historyBody?.history)
              ? historyBody.history.map((point: { date: string; close: number }) => ({
                  time: Math.floor(new Date(point.date).getTime() / 1000),
                  value: point.close,
                }))
              : null;

            return {
              symbol: raw.symbol,
              name: raw.name,
              price: quote?.close ?? null,
              change: quote ? quote.close - quote.open : null,
              percentChange: quote?.percentChange ?? null,
              history,
            };
          })
        );

        if (!cancelled) setItems(enriched);
      } catch {
        if (!cancelled) setError("Failed to load your watchlist");
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [status]);

  function handleRemove(symbol: string) {
    setRemovingSymbols((prev) => new Set(prev).add(symbol));

    // Fire the deletion now rather than waiting on the exit animation —
    // the animation is purely a visual delay on the local list, not a
    // gate on the actual mutation.
    fetch(`/api/watchlist/${encodeURIComponent(symbol)}`, { method: "DELETE" }).catch(() => {});

    const timeoutId = setTimeout(() => {
      setItems((prev) => (prev ? prev.filter((item) => item.symbol !== symbol) : prev));
      setRemovingSymbols((prev) => {
        const next = new Set(prev);
        next.delete(symbol);
        return next;
      });
      removalTimeoutsRef.current.delete(symbol);
    }, CARD_EXIT_DURATION_MS);

    removalTimeoutsRef.current.set(symbol, timeoutId);
  }

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
            onRemove={() => handleRemove(item.symbol)}
          />
        ))}
      </div>
    </main>
  );
}
