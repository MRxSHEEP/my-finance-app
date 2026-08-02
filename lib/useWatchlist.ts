"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import type { WatchlistCardData } from "@/components/WatchlistCard";

// Matches WatchlistCard's own transition duration (lib/cardStyles.ts's
// shared card shell uses duration-200) so the item is removed from the
// list exactly when its exit animation finishes, not before or after.
const CARD_EXIT_DURATION_MS = 200;

// Shared by app/watchlist/page.tsx and the embedded section on
// app/stocks/page.tsx — both render the same WatchlistCard, so the
// fetch/enrich/remove logic behind it only needs to exist once.
export function useWatchlistItems() {
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

        const rawItems: Array<{ symbol: string; name: string | null; assetType?: string }> =
          Array.isArray(listBody.items) ? listBody.items : [];

        const enriched = await Promise.all(
          rawItems.map(async (raw): Promise<WatchlistCardData> => {
            const assetType: "stock" | "crypto" = raw.assetType === "crypto" ? "crypto" : "stock";

            if (assetType === "crypto") {
              // /api/crypto/detail is keyed by CoinGecko id (stored as
              // raw.symbol) and already returns both overview stats and
              // line history in one call, unlike the stock pair below.
              const detailResponse = await fetch(
                `/api/crypto/detail?id=${encodeURIComponent(raw.symbol)}&range=1M`
              ).catch(() => null);
              const detailBody =
                detailResponse && detailResponse.ok ? await detailResponse.json().catch(() => null) : null;

              const overview = detailBody?.overview ?? null;
              const historyPoints: Array<{ date: string; close: number }> = Array.isArray(
                detailBody?.history
              )
                ? detailBody.history
                : [];
              const history: WatchlistCardData["history"] =
                historyPoints.length > 0
                  ? historyPoints.map((point) => ({
                      time: Math.floor(new Date(point.date.replace(" ", "T") + "Z").getTime() / 1000),
                      value: point.close,
                    }))
                  : null;

              // /api/crypto/detail's overview only carries a 24h percent
              // change, not an absolute one (unlike the stock quote below)
              // — derive it from price + percent so the card's dollar-
              // change line isn't just silently blank for every crypto row.
              const price = overview?.currentPrice ?? null;
              const percentChange = overview?.percentChange24h ?? null;
              const change =
                price !== null && percentChange !== null
                  ? price - price / (1 + percentChange / 100)
                  : null;

              return {
                symbol: raw.symbol,
                displaySymbol: overview?.symbol ? overview.symbol.toUpperCase() : raw.symbol.toUpperCase(),
                name: raw.name,
                assetType,
                price,
                change,
                percentChange,
                history,
                stale: false,
              };
            }

            // No history fetch for stocks anymore (see WatchlistCard) — the
            // card no longer renders a chart for this path, and the old
            // /api/stock/history call it fed was a ~22-day daily-close line
            // shown next to Finnhub's one-day % change, unlabelled: a real
            // period mismatch, not just a display choice. Confirmed live
            // this call could hang 60+s under load, which was blocking the
            // otherwise-fast quote fetch below in the same Promise.all —
            // dropping it also fixes that.
            const quoteResponse = await fetch(`/api/stock?ticker=${encodeURIComponent(raw.symbol)}`).catch(
              () => null
            );
            const quote =
              quoteResponse && quoteResponse.ok ? await quoteResponse.json().catch(() => null) : null;

            return {
              symbol: raw.symbol,
              displaySymbol: raw.symbol,
              name: raw.name,
              assetType,
              price: quote?.close ?? null,
              change: quote ? quote.close - quote.open : null,
              percentChange: quote?.percentChange ?? null,
              history: null,
              stale: Boolean(quote?.stale),
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

  function remove(symbol: string) {
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

  return { status, items, error, removingSymbols, remove };
}
