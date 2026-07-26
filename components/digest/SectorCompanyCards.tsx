"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import RevealOnScroll from "@/components/RevealOnScroll";
import MiniLineChart from "@/components/MiniLineChart";
import {
  STOCK_CATALOG,
  CATALOG_SECTORS,
  CATALOG_SECTOR_ICONS,
  CATALOG_SECTOR_COLORS,
  type CatalogSector,
} from "@/lib/stockCatalog";

const COMPANIES_PER_SECTOR = 3;
// Matches app/api/stock/mini-quotes/route.ts's own MAX_SYMBOLS cap.
const MINI_QUOTES_BATCH_SIZE = 25;

interface MiniQuote {
  symbol: string;
  price: number | null;
  percentChange: number | null;
  history: { time: number; value: number }[] | null;
}

// Static per-sector picks — the first N entries already listed under each
// sector in lib/stockCatalog.ts's STOCK_CATALOG (roughly biggest-first as
// that file lists them within each block), per the confirmed "hardcoded to
// start, not a live market-cap ranking system" scope.
const SECTOR_TICKERS: Record<CatalogSector, string[]> = Object.fromEntries(
  CATALOG_SECTORS.map((sector) => [
    sector,
    STOCK_CATALOG.filter((entry) => entry.sector === sector)
      .slice(0, COMPANIES_PER_SECTOR)
      .map((entry) => entry.symbol),
  ])
) as Record<CatalogSector, string[]>;

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

interface SectorCompanyCardsProps {
  watchlistSymbols: Set<string>;
  // Which of the 13 CATALOG_SECTORS to render — undefined/omitted means
  // "all of them" (the default, unconfigured view). Passed down from
  // app/page.tsx's DashboardConfig; this component itself has zero
  // awareness of the config system otherwise.
  selectedSectors?: CatalogSector[];
}

export default function SectorCompanyCards({ watchlistSymbols, selectedSectors }: SectorCompanyCardsProps) {
  const visibleSectors = selectedSectors ?? CATALOG_SECTORS;
  const [quotesBySymbol, setQuotesBySymbol] = useState<Map<string, MiniQuote> | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const allSymbols = [...new Set(visibleSectors.flatMap((sector) => SECTOR_TICKERS[sector]))];
      const batches = chunk(allSymbols, MINI_QUOTES_BATCH_SIZE);
      try {
        const results = await Promise.all(
          batches.map(async (batch) => {
            const response = await fetch(`/api/stock/mini-quotes?symbols=${encodeURIComponent(batch.join(","))}`);
            const body = await response.json().catch(() => null);
            return Array.isArray(body?.quotes) ? (body.quotes as MiniQuote[]) : [];
          })
        );
        if (cancelled) return;
        setQuotesBySymbol(new Map(results.flat().map((q) => [q.symbol, q])));
      } catch {
        if (!cancelled) setQuotesBySymbol(new Map());
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [visibleSectors]);

  return (
    <RevealOnScroll className="flex w-full flex-col gap-6">
      <h2 className="text-2xl font-bold text-white">Sectors at a Glance</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {visibleSectors.map((sector) => {
          const Icon = CATALOG_SECTOR_ICONS[sector];
          const colors = CATALOG_SECTOR_COLORS[sector];
          const tickers = SECTOR_TICKERS[sector];

          return (
            <div key={sector} className="flex flex-col gap-2 rounded-lg border border-white/10 bg-white/[0.02] p-3">
              <div className="flex items-center gap-2">
                <Icon size={16} className={colors.icon} />
                <h3 className="text-sm font-semibold text-white">{sector}</h3>
              </div>
              <div className="flex flex-col gap-1.5">
                {tickers.map((symbol) => {
                  const quote = quotesBySymbol?.get(symbol);
                  const isUp = (quote?.percentChange ?? 0) >= 0;
                  const isWatching = watchlistSymbols.has(symbol);
                  return (
                    <Link
                      key={symbol}
                      href={`/stocks?ticker=${encodeURIComponent(symbol)}`}
                      className="flex items-center gap-2 rounded-md px-1.5 py-1 transition-colors duration-150 ease-out hover:bg-white/5"
                    >
                      <span
                        className={`w-14 shrink-0 truncate text-xs font-semibold ${isWatching ? "text-amber-400" : "text-white"}`}
                      >
                        {symbol}
                      </span>
                      <div className="h-5 w-16 shrink-0">
                        {quote?.history && quote.history.length > 1 ? <MiniLineChart data={quote.history} height={20} /> : null}
                      </div>
                      <span
                        className={`ml-auto shrink-0 text-xs font-medium ${
                          quote?.percentChange != null ? (isUp ? "text-green-500" : "text-red-500") : "text-white/30"
                        }`}
                      >
                        {quote?.percentChange != null ? `${isUp ? "+" : ""}${quote.percentChange.toFixed(1)}%` : "—"}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </RevealOnScroll>
  );
}
