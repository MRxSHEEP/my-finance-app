"use client";

import { useEffect, useRef, useState } from "react";
import { Gem, Fuel, Droplet, Flame, Layers, Sprout, Wheat, Leaf, type LucideIcon } from "lucide-react";
import type { Article } from "@/components/NewsTicker";
import { ArticleCard, ArticleCardSkeleton } from "@/components/ArticleCard";
import MiniLineChart from "@/components/MiniLineChart";

const COMMODITY_POLL_INTERVAL_MS = 30_000;

interface Commodity {
  symbol: string;
  name: string;
  price: number | null;
  change: number | null;
  percentChange: number | null;
  history: { time: number; value: number }[] | null;
}

// A distinct icon + tint per commodity so the grid reads as more than a
// bare data table — chosen for the clearest available semantic match
// (Wheat has a literal "Wheat" icon; others lean on the closest concept:
// a flame for gas, a droplet/fuel pump for the two oil grades, etc.).
const COMMODITY_ICON: Record<string, { icon: LucideIcon; className: string }> = {
  "C:XAUUSD": { icon: Gem, className: "text-amber-400" },
  "C:XAGUSD": { icon: Gem, className: "text-zinc-400" },
  USO: { icon: Fuel, className: "text-neutral-400" },
  BNO: { icon: Droplet, className: "text-neutral-400" },
  UNG: { icon: Flame, className: "text-blue-400" },
  CPER: { icon: Layers, className: "text-orange-600" },
  CORN: { icon: Sprout, className: "text-yellow-500" },
  WEAT: { icon: Wheat, className: "text-amber-500" },
  SOYB: { icon: Leaf, className: "text-green-600" },
};

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
// Commodity grid
// ---------------------------------------------------------------------

function CommodityCardSkeleton() {
  return (
    <div className="flex flex-col gap-3 rounded-md border border-black/10 p-4 dark:border-white/15">
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 animate-pulse rounded-full bg-foreground/10" />
        <div className="h-4 w-24 animate-pulse rounded bg-foreground/10" />
      </div>
      <div className="h-6 w-24 animate-pulse rounded bg-foreground/10" />
      <div className="h-10 w-full animate-pulse rounded bg-foreground/10" />
      <div className="h-4 w-32 animate-pulse rounded bg-foreground/10" />
    </div>
  );
}

function CommodityCard({ commodity }: { commodity: Commodity }) {
  const hasQuote =
    commodity.price != null && commodity.change != null && commodity.percentChange != null;
  const isUp = hasQuote && commodity.percentChange! > 0;
  const isDown = hasQuote && commodity.percentChange! < 0;
  const iconDef = COMMODITY_ICON[commodity.symbol];
  const Icon = iconDef?.icon;

  return (
    <div className="flex flex-col gap-2 rounded-md border border-black/10 p-4 dark:border-white/15">
      <div className="flex items-center gap-2">
        {Icon && (
          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-foreground/5 ${iconDef.className}`}>
            <Icon size={16} />
          </div>
        )}
        <h3 className="font-semibold text-foreground">{commodity.name}</h3>
      </div>

      <span className="text-lg font-semibold text-foreground">
        {hasQuote ? currencyFormatter.format(commodity.price!) : "—"}
      </span>

      <div className="h-10 w-full">
        {commodity.history && commodity.history.length > 0 ? (
          <MiniLineChart data={commodity.history} height={40} />
        ) : (
          <div className="h-full w-full animate-pulse rounded bg-foreground/10" />
        )}
      </div>

      {hasQuote && (
        <span
          className={`text-xs font-medium ${
            isUp ? "text-green-500" : isDown ? "text-red-500" : "text-foreground/50"
          }`}
        >
          {isUp ? "▲" : isDown ? "▼" : ""} {formatChange(commodity.change!)} (
          {commodity.percentChange! >= 0 ? "+" : ""}
          {commodity.percentChange!.toFixed(2)}%)
        </span>
      )}
    </div>
  );
}

function CommodityGridSection() {
  const [commodities, setCommodities] = useState<Commodity[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const response = await fetch("/api/ticker");
        if (!response.ok) {
          if (!cancelled && !hasLoadedRef.current) setError("Failed to load commodity prices");
          return;
        }
        const data = await response.json().catch(() => null);
        const list: Commodity[] = Array.isArray(data?.commodities) ? data.commodities : [];
        if (cancelled || list.length === 0) return;
        hasLoadedRef.current = true;
        setError(null);
        setCommodities(list);
      } catch {
        if (!cancelled && !hasLoadedRef.current) setError("Failed to load commodity prices");
      }
    }

    poll();
    const id = setInterval(poll, COMMODITY_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return (
    <section className="flex w-full flex-col gap-4">
      <h2 className="text-xl font-bold text-foreground">Commodity Prices</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {commodities === null &&
          !error &&
          Array.from({ length: 9 }).map((_, i) => <CommodityCardSkeleton key={i} />)}

        {error && commodities === null && (
          <p className="col-span-full text-sm text-red-500">{error}</p>
        )}

        {commodities?.map((commodity) => (
          <CommodityCard key={commodity.symbol} commodity={commodity} />
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------
// News
// ---------------------------------------------------------------------

function CommoditiesNewsSection() {
  const [articles, setArticles] = useState<Article[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/commodities/news");
        const body = await response.json();

        if (cancelled) return;

        if (!response.ok) {
          setError(body.error ?? "Failed to load commodities news");
          setArticles(null);
          return;
        }

        setArticles(Array.isArray(body.articles) ? body.articles : []);
      } catch {
        if (!cancelled) {
          setError("Failed to load commodities news");
          setArticles(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="flex w-full flex-col gap-4">
      <h2 className="text-xl font-bold text-foreground">Commodities News</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {loading && Array.from({ length: 6 }).map((_, i) => <ArticleCardSkeleton key={i} />)}

        {!loading && error && (
          <p className="col-span-full text-sm text-red-500">{error}</p>
        )}

        {!loading && !error && articles && articles.length === 0 && (
          <p className="col-span-full text-sm text-foreground/60">No articles found.</p>
        )}

        {!loading &&
          !error &&
          articles?.map((article, index) => (
            <ArticleCard key={`${article.url}-${index}`} article={article} />
          ))}
      </div>
    </section>
  );
}

export default function CommoditiesPage() {
  return (
    <main className="flex flex-1 flex-col items-center gap-6 p-8 pt-16">
      <h1 className="text-3xl font-bold text-foreground">Commodities</h1>
      <div className="flex w-full max-w-6xl flex-col gap-10">
        <CommodityGridSection />
        <CommoditiesNewsSection />
      </div>
    </main>
  );
}
