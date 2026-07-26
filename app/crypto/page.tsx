"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import type { Article } from "@/components/NewsTicker";
import { ArticleCard, ArticleCardSkeleton } from "@/components/ArticleCard";
import MiniLineChart from "@/components/MiniLineChart";
import RevealOnScroll from "@/components/RevealOnScroll";
import CryptoDetailSection from "@/components/crypto/CryptoDetailSection";
import CryptoHeaderBackground from "@/components/crypto/CryptoHeaderBackground";
import GlobalMarketStats from "@/components/crypto/GlobalMarketStats";
import { RankingsSection, TopMoversSection } from "@/components/crypto/MarketOverview";
import SectorPerformance from "@/components/crypto/SectorPerformance";
import type { CoinRanking, GlobalMarketStats as GlobalMarketStatsData } from "@/lib/cryptoTypes";

// Both hit the same server-side cached CoinGecko datasets (see
// app/api/crypto/rankings and app/api/crypto/global), so polling this
// often just re-reads that cache rather than re-hitting CoinGecko's own
// tight rate limit on every tick.
const MARKET_DATA_POLL_INTERVAL_MS = 60_000;

// Top 8 Most-Traded's curated symbol set — unchanged from the previous
// Finnhub-backed version, just now sourced from the same shared rankings
// dataset as every other section instead of a second, independently-timed
// provider.
const TOP8_SYMBOLS = ["btc", "eth", "bnb", "sol", "xrp", "doge", "ada", "avax"];

// Decimal precision scales with price magnitude — a fixed 2 decimals
// would round DOGE-sized prices (~$0.07) away to nothing.
function decimalsForPrice(price: number): number {
  if (price >= 100) return 2;
  if (price >= 1) return 3;
  return 5;
}

function formatCoinPrice(price: number): string {
  const decimals = decimalsForPrice(price);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(price);
}

function formatCoinChange(change: number, referencePrice: number): string {
  const decimals = decimalsForPrice(referencePrice);
  const formatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(Math.abs(change));
  return `${change >= 0 ? "+" : "-"}${formatted}`;
}

// CoinGecko's sparkline is a flat array of hourly closes ending "now" —
// synthesized into real, ascending Unix-second timestamps (spaced an
// hour apart) since lightweight-charts (which MiniLineChart wraps)
// expects genuine UTCTimestamp values, not just an ascending index.
function sparklineToHistory(values: number[]): { time: number; value: number }[] {
  const nowSec = Math.floor(Date.now() / 1000);
  const hourSec = 3600;
  return values.map((value, index) => ({
    time: nowSec - (values.length - 1 - index) * hourSec,
    value,
  }));
}

// ---------------------------------------------------------------------
// Banner
// ---------------------------------------------------------------------

function CryptoBanner({ sentiment }: { sentiment: number | null }) {
  return (
    <div className="relative w-full overflow-hidden border-b border-white/10" style={{ height: 176 }}>
      <CryptoHeaderBackground sentiment={sentiment} />

      <div className="relative z-10 flex h-full flex-col items-center justify-center gap-2 px-4 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">Crypto</h1>
        <p className="text-sm text-white/50">
          Live prices for the world&apos;s most-traded digital assets
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// Coin grid
// ---------------------------------------------------------------------

function CoinCardSkeleton() {
  return (
    <div className="flex flex-col gap-3 rounded-md border border-black/10 p-4 dark:border-white/15">
      <div className="flex flex-col gap-1.5">
        <div className="h-4 w-24 animate-pulse rounded bg-foreground/10" />
        <div className="h-3 w-10 animate-pulse rounded bg-foreground/10" />
      </div>
      <div className="h-16 w-full animate-pulse rounded bg-foreground/10" />
      <div className="h-5 w-28 animate-pulse rounded bg-foreground/10" />
    </div>
  );
}

function CoinCard({ coin }: { coin: CoinRanking }) {
  const change = coin.percentChange24h;
  const isUp = change !== null && change > 0;
  const isDown = change !== null && change < 0;
  const sparklineHistory = coin.sparkline7d && coin.sparkline7d.length > 0 ? sparklineToHistory(coin.sparkline7d) : null;

  return (
    <Link
      href={`/crypto/${coin.id}`}
      className="flex flex-col gap-3 rounded-md border border-black/10 p-4 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-black/20 hover:shadow-md dark:border-white/15 dark:hover:border-white/25"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold text-foreground">
          {coin.name} <span className="font-normal text-foreground/50">({coin.symbol.toUpperCase()})</span>
        </h3>
        {/* The sparkline covers 7 days (CoinGecko's fixed window); the
            change figure below it is 24h — labeled explicitly so the two
            never read as contradictory. */}
        <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-foreground/40">7D</span>
      </div>

      <div className="h-16 w-full">
        {sparklineHistory ? (
          <MiniLineChart data={sparklineHistory} height={64} />
        ) : (
          <div className="h-full w-full animate-pulse rounded bg-foreground/10" />
        )}
      </div>

      <div className="flex flex-col gap-0.5">
        <span className="text-lg font-semibold text-foreground">{formatCoinPrice(coin.currentPrice)}</span>
        {change !== null && (
          <span
            className={`text-xs font-medium ${
              isUp ? "text-green-500" : isDown ? "text-red-500" : "text-foreground/50"
            }`}
          >
            {isUp ? "▲" : isDown ? "▼" : ""}{" "}
            {coin.priceChange24h !== null ? `${formatCoinChange(coin.priceChange24h, coin.currentPrice)} ` : ""}
            ({change >= 0 ? "+" : ""}
            {change.toFixed(2)}% <span className="text-foreground/40">24h</span>)
          </span>
        )}
      </div>
    </Link>
  );
}

interface CoinGridSectionProps {
  coins: CoinRanking[] | null;
  error: string | null;
}

// Derives the "Top 8" from the same shared rankings dataset the rest of
// the page reads (see CryptoPage below) instead of its own independent
// Finnhub+Polygon fetch — that second, differently-sourced price feed
// was exactly why Bitcoin could show two different prices on this page
// at once.
function CoinGridSection({ coins, error }: CoinGridSectionProps) {
  const top8 = coins?.filter((coin) => TOP8_SYMBOLS.includes(coin.symbol.toLowerCase())) ?? null;

  return (
    <section className="flex w-full flex-col gap-4">
      <h2 className="text-xl font-bold text-foreground">Top 8 Most-Traded</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {top8 === null &&
          !error &&
          Array.from({ length: 8 }).map((_, i) => <CoinCardSkeleton key={i} />)}

        {error && top8 === null && (
          <p className="col-span-full text-sm text-red-500">{error}</p>
        )}

        {top8?.map((coin) => <CoinCard key={coin.id} coin={coin} />)}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------
// News
// ---------------------------------------------------------------------

function CryptoNewsSection() {
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
        const response = await fetch("/api/crypto/news");
        const body = await response.json();

        if (cancelled) return;

        if (!response.ok) {
          setError(body.error ?? "Failed to load crypto news");
          setArticles(null);
          return;
        }

        setArticles(Array.isArray(body.articles) ? body.articles : []);
        setStale(Boolean(body.stale));
        setDegraded(Boolean(body.degraded));
      } catch {
        if (!cancelled) {
          setError("Failed to load crypto news");
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
      <h2 className="text-xl font-bold text-foreground">Recent Crypto News</h2>
      <div className="flex w-full flex-col">
        {loading &&
          Array.from({ length: 6 }).map((_, i) => <ArticleCardSkeleton key={i} />)}

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
    </section>
  );
}

export default function CryptoPage() {
  const [coins, setCoins] = useState<CoinRanking[] | null>(null);
  const [coinsError, setCoinsError] = useState<string | null>(null);
  const [globalStats, setGlobalStats] = useState<GlobalMarketStatsData | null>(null);
  const [globalStatsError, setGlobalStatsError] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);

  // The one shared fetch behind every price/market figure on this page —
  // CryptoDetailSection, GlobalMarketStats, CoinGridSection, and
  // MarketOverview all read the same `coins`/`globalStats` state rather
  // than each hitting CoinGecko (or, previously, Finnhub/Polygon)
  // independently, which is what let the same coin show different prices
  // in different sections at once.
  useEffect(() => {
    let cancelled = false;

    async function loadCoins() {
      try {
        const response = await fetch("/api/crypto/rankings");
        const body = await response.json().catch(() => null);
        if (cancelled) return;

        const list: CoinRanking[] = Array.isArray(body?.coins) ? body.coins : [];
        if (list.length === 0) {
          setCoinsError("Failed to load market data.");
          return;
        }
        setCoinsError(null);
        setCoins(list);
        setGeneratedAt(body.generatedAt ?? null);
      } catch {
        if (!cancelled) setCoinsError("Failed to load market data.");
      }
    }

    async function loadGlobalStats() {
      try {
        const response = await fetch("/api/crypto/global");
        const body = await response.json().catch(() => null);
        if (cancelled) return;

        if (!body?.stats) {
          setGlobalStatsError("Failed to load global market stats.");
          return;
        }
        setGlobalStatsError(null);
        setGlobalStats(body.stats);
      } catch {
        if (!cancelled) setGlobalStatsError("Failed to load global market stats.");
      }
    }

    function poll() {
      loadCoins();
      loadGlobalStats();
    }

    poll();
    const id = setInterval(poll, MARKET_DATA_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return (
    <main className="flex flex-1 flex-col items-center gap-10 pb-10">
      <CryptoBanner sentiment={globalStats?.marketCapChangePercentage24h ?? null} />
      <div className="flex w-full max-w-6xl flex-col gap-10 px-8">
        <RevealOnScroll className="flex w-full flex-col items-center">
          <Suspense fallback={null}>
            <CryptoDetailSection sharedCoins={coins} />
          </Suspense>
        </RevealOnScroll>
        <GlobalMarketStats stats={globalStats} error={globalStatsError} generatedAt={generatedAt} />
        <TopMoversSection coins={coins} error={coinsError} />
        <RevealOnScroll>
          <CoinGridSection coins={coins} error={coinsError} />
        </RevealOnScroll>
        <RankingsSection coins={coins} error={coinsError} />
        <SectorPerformance coins={coins} globalStats={globalStats} error={coinsError} />
        <RevealOnScroll>
          <CryptoNewsSection />
        </RevealOnScroll>
      </div>
    </main>
  );
}
