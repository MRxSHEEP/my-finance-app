"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Fuel, Droplet, Flame, Layers, Sprout, Wheat, Leaf } from "lucide-react";
import type { Article } from "@/components/NewsTicker";
import { ArticleCard, ArticleCardSkeleton } from "@/components/ArticleCard";
import MiniLineChart from "@/components/MiniLineChart";
import RevealOnScroll from "@/components/RevealOnScroll";
import CommoditiesHeaderBackground from "@/components/commodities/CommoditiesHeaderBackground";
import { IngotIcon } from "@/components/commodities/IngotIcon";

const COMMODITY_POLL_INTERVAL_MS = 30_000;

// Matches the stagger already used by the stock catalog/crypto grids
// (components/stocks/StockCatalogSection.tsx) — capped so a 9-item grid
// doesn't feel slower to finish revealing than a much longer list would.
const STAGGER_MS = 30;
const MAX_STAGGER_MS = 300;

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
// Gold/silver use the shared bar/ingot glyph (components/commodities/
// IngotIcon.tsx) rather than a gem/coin shape — matches the ingot
// treatment in the commodities header background. `icon` is typed
// structurally (not lucide's own `LucideIcon`) so this custom SVG
// component can sit in the same map as the lucide ones.
const COMMODITY_ICON: Record<string, { icon: React.ComponentType<{ size?: number; className?: string }>; className: string }> = {
  "C:XAUUSD": { icon: IngotIcon, className: "text-amber-400" },
  "C:XAGUSD": { icon: IngotIcon, className: "text-zinc-400" },
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
// Banner
// ---------------------------------------------------------------------

function CommoditiesBanner() {
  return (
    <div className="relative w-full overflow-hidden border-b border-white/10" style={{ height: 176 }}>
      <CommoditiesHeaderBackground />

      <div className="relative z-10 flex h-full flex-col items-center justify-center gap-2 px-4 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">Commodities</h1>
        <p className="text-sm text-white/50">
          Gold, oil, and other key raw materials driving the real economy
        </p>
      </div>
    </div>
  );
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

function CommodityCard({
  commodity,
  highlighted,
  loaded,
}: {
  commodity: Commodity;
  highlighted: boolean;
  // True once the parent grid's poll has resolved at least once — lets
  // this card tell "history not in yet" (still show the pulsing skeleton,
  // it may still arrive) apart from "history genuinely unavailable this
  // poll" (show a calm static placeholder instead of a skeleton that
  // implies something is still loading forever).
  loaded: boolean;
}) {
  const hasQuote =
    commodity.price != null && commodity.change != null && commodity.percentChange != null;
  const isUp = hasQuote && commodity.percentChange! > 0;
  const isDown = hasQuote && commodity.percentChange! < 0;
  const iconDef = COMMODITY_ICON[commodity.symbol];
  const Icon = iconDef?.icon;
  const hasHistory = commodity.history !== null && commodity.history.length > 0;

  return (
    <Link
      href={`/commodities/${encodeURIComponent(commodity.symbol)}`}
      id={`commodity-${commodity.symbol}`}
      className={`flex flex-col gap-2 rounded-md border p-4 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-black/20 hover:shadow-md dark:hover:border-white/25 ${
        highlighted
          ? "border-blue-400/60 ring-2 ring-blue-400/40 shadow-lg shadow-blue-400/20"
          : "border-black/10 dark:border-white/15"
      }`}
    >
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
        {hasHistory ? (
          <MiniLineChart data={commodity.history!} height={40} />
        ) : loaded ? (
          <div className="flex h-full w-full items-center justify-center rounded bg-foreground/5">
            <span className="h-px w-full max-w-[60%] bg-foreground/15" />
          </div>
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
    </Link>
  );
}

function CommodityGridSection() {
  const searchParams = useSearchParams();
  const highlightSymbol = searchParams.get("highlight");
  const [commodities, setCommodities] = useState<Commodity[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeHighlight, setActiveHighlight] = useState<string | null>(null);
  const hasLoadedRef = useRef(false);
  // Tracks which `highlight` value has already been scrolled-to, so a
  // later poll refresh (every 30s) doesn't keep re-scrolling/re-flashing
  // the same card — only a genuinely new `?highlight=` value should.
  const handledHighlightRef = useRef<string | null>(null);

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

  // Scrolls to and briefly highlights the card named by `?highlight=`
  // (from the top ticker bar's Gold/Oil/Silver items) once the grid has
  // actually rendered — waiting on `commodities` rather than firing on
  // mount, since the target card doesn't exist in the DOM until then.
  useEffect(() => {
    if (!highlightSymbol || !commodities) return;
    if (handledHighlightRef.current === highlightSymbol) return;

    const el = document.getElementById(`commodity-${highlightSymbol}`);
    if (!el) return;

    handledHighlightRef.current = highlightSymbol;

    function activateHighlight() {
      el!.scrollIntoView({ behavior: "smooth", block: "center" });
      setActiveHighlight(highlightSymbol);
    }
    activateHighlight();

    const timer = setTimeout(() => setActiveHighlight(null), 2500);
    return () => clearTimeout(timer);
  }, [highlightSymbol, commodities]);

  return (
    <RevealOnScroll className="flex w-full flex-col gap-4">
      <h2 className="text-xl font-bold text-foreground">Commodity Prices</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {commodities === null &&
          !error &&
          Array.from({ length: 9 }).map((_, i) => <CommodityCardSkeleton key={i} />)}

        {error && commodities === null && (
          <p className="col-span-full text-sm text-red-500">{error}</p>
        )}

        {commodities?.map((commodity, index) => (
          <RevealOnScroll key={commodity.symbol} delayMs={Math.min(index * STAGGER_MS, MAX_STAGGER_MS)}>
            <CommodityCard
              commodity={commodity}
              highlighted={commodity.symbol === activeHighlight}
              loaded
            />
          </RevealOnScroll>
        ))}
      </div>
    </RevealOnScroll>
  );
}

// ---------------------------------------------------------------------
// News
// ---------------------------------------------------------------------

function CommoditiesNewsSection() {
  const [articles, setArticles] = useState<Article[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [degraded, setDegraded] = useState(false);
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
        setStale(Boolean(body.stale));
        setDegraded(Boolean(body.degraded));
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
    <RevealOnScroll className="flex w-full flex-col gap-4">
      <h2 className="text-xl font-bold text-foreground">Commodities News</h2>
      <div className="flex w-full flex-col">
        {loading && Array.from({ length: 6 }).map((_, i) => <ArticleCardSkeleton key={i} />)}

        {!loading && error && <p className="text-sm text-red-500">{error}</p>}

        {!loading && !error && stale && (
          <p className="mb-2 text-xs font-medium text-amber-500">
            Showing recent headlines — live updates paused
          </p>
        )}

        {!loading && !error && articles && articles.length === 0 && (
          <p className="text-sm text-foreground/60">
            {degraded ? "Live news is temporarily unavailable — check back soon." : "No articles found."}
          </p>
        )}

        {!loading &&
          !error &&
          articles?.map((article, index) => (
            <ArticleCard key={`${article.url}-${index}`} article={article} />
          ))}
      </div>
    </RevealOnScroll>
  );
}

export default function CommoditiesPage() {
  return (
    <main className="flex flex-1 flex-col items-center gap-10 pb-10">
      <CommoditiesBanner />
      <div className="flex w-full max-w-6xl flex-col gap-10 px-8">
        <Suspense fallback={null}>
          <CommodityGridSection />
        </Suspense>
        <CommoditiesNewsSection />
      </div>
    </main>
  );
}
