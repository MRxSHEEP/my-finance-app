"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Star } from "lucide-react";
import RevealOnScroll from "@/components/RevealOnScroll";
import MiniLineChart from "@/components/MiniLineChart";

interface MiniQuote {
  symbol: string;
  price: number | null;
  percentChange: number | null;
  history: { time: number; value: number }[] | null;
}

const currencyFormatter = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

// Signed-in only — the one section of the digest that's entirely absent
// for signed-out visitors. Takes the parent's already-fetched watchlist
// symbol set as a prop (see app/page.tsx) rather than fetching its own
// copy, mirroring app/earnings/page.tsx's exact "fetch once, pass down"
// pattern for the same data.
export default function WatchlistDigestSection({ symbols }: { symbols: Set<string> }) {
  const [quotes, setQuotes] = useState<MiniQuote[] | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const stockSymbols = [...symbols].slice(0, 25);
      if (stockSymbols.length === 0) {
        if (!cancelled) setQuotes([]);
        return;
      }
      try {
        const response = await fetch(`/api/stock/mini-quotes?symbols=${encodeURIComponent(stockSymbols.join(","))}`);
        const body = await response.json().catch(() => null);
        if (!cancelled) setQuotes(Array.isArray(body?.quotes) ? body.quotes : []);
      } catch {
        if (!cancelled) setQuotes([]);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [symbols]);

  if (!quotes || quotes.length === 0) return null;

  return (
    <RevealOnScroll className="flex w-full flex-col gap-4">
      <div className="flex items-center gap-2">
        <Star size={20} className="text-amber-400" />
        <h2 className="text-2xl font-bold text-white">Your Watchlist</h2>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {quotes.map((q) => {
          const isUp = (q.percentChange ?? 0) >= 0;
          return (
            <Link
              key={q.symbol}
              href={`/stocks?ticker=${encodeURIComponent(q.symbol)}`}
              className="flex flex-col gap-1.5 rounded-lg border border-white/10 bg-white/[0.02] p-3 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-white/20"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-white">{q.symbol}</span>
                {q.percentChange != null && (
                  <span className={`text-xs font-medium ${isUp ? "text-green-500" : "text-red-500"}`}>
                    {isUp ? "+" : ""}
                    {q.percentChange.toFixed(2)}%
                  </span>
                )}
              </div>
              <span className="text-lg font-bold text-white">{q.price != null ? currencyFormatter.format(q.price) : "—"}</span>
              {q.history && q.history.length > 1 && (
                <div className="h-8 w-full">
                  <MiniLineChart data={q.history} height={32} />
                </div>
              )}
            </Link>
          );
        })}
      </div>
    </RevealOnScroll>
  );
}
