"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { TrendingUp, TrendingDown } from "lucide-react";
import RevealOnScroll from "@/components/RevealOnScroll";

interface MoverRow {
  symbol: string;
  price: number;
  percentChange: number;
}

interface MoversData {
  gainers: MoverRow[];
  losers: MoverRow[];
}

const currencyFormatter = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

function MoverList({ rows, watchlistSymbols }: { rows: MoverRow[]; watchlistSymbols: Set<string> }) {
  return (
    <div className="flex flex-col gap-2">
      {rows.map((row) => {
        const isUp = row.percentChange >= 0;
        return (
          <Link
            key={row.symbol}
            href={`/stocks?ticker=${encodeURIComponent(row.symbol)}`}
            className="flex items-center justify-between gap-2 rounded-md px-1.5 py-1 text-sm transition-colors duration-150 ease-out hover:bg-white/5"
          >
            <span className={`font-semibold ${watchlistSymbols.has(row.symbol) ? "text-amber-400" : "text-white"}`}>
              {row.symbol}
            </span>
            <span className="text-white/60">{currencyFormatter.format(row.price)}</span>
            <span className={`font-medium ${isUp ? "text-green-500" : "text-red-500"}`}>
              {isUp ? "+" : ""}
              {row.percentChange.toFixed(2)}%
            </span>
          </Link>
        );
      })}
    </div>
  );
}

// Reuses lib/finnhubQuoteCache.ts's fetchFinnhubQuote (server-side, via the
// new app/api/movers/route.ts) — no client-side ranking logic of its own.
export default function MoversDigestSection({ watchlistSymbols }: { watchlistSymbols: Set<string> }) {
  const [data, setData] = useState<MoversData | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch("/api/movers");
        const body = await response.json().catch(() => null);
        if (cancelled) return;
        if (!response.ok || !body) {
          setError(true);
          return;
        }
        setData(body);
      } catch {
        if (!cancelled) setError(true);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <RevealOnScroll className="flex w-full flex-col gap-4">
      <h2 className="text-2xl font-bold text-white">Market Movers</h2>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-3 rounded-lg border border-white/10 bg-white/[0.02] p-4">
          <div className="flex items-center gap-1.5">
            <TrendingUp size={16} className="text-green-500" />
            <h3 className="text-sm font-semibold text-white">Top Gainers</h3>
          </div>
          {data ? <MoverList rows={data.gainers} watchlistSymbols={watchlistSymbols} /> : error ? (
            <p className="text-sm text-white/50">Movers data is temporarily unavailable.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-4 w-full animate-pulse rounded bg-white/10" />)}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3 rounded-lg border border-white/10 bg-white/[0.02] p-4">
          <div className="flex items-center gap-1.5">
            <TrendingDown size={16} className="text-red-500" />
            <h3 className="text-sm font-semibold text-white">Top Losers</h3>
          </div>
          {data ? <MoverList rows={data.losers} watchlistSymbols={watchlistSymbols} /> : error ? (
            <p className="text-sm text-white/50">Movers data is temporarily unavailable.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-4 w-full animate-pulse rounded bg-white/10" />)}
            </div>
          )}
        </div>
      </div>
    </RevealOnScroll>
  );
}
