"use client";

import { useEffect, useRef, useState } from "react";
import { Bitcoin, CircleDollarSign, Coins, type LucideIcon } from "lucide-react";
import type { Article } from "@/components/NewsTicker";
import { ArticleCard, ArticleCardSkeleton } from "@/components/ArticleCard";
import MiniLineChart from "@/components/MiniLineChart";
import RevealOnScroll from "@/components/RevealOnScroll";
import CryptoDetailSection from "@/components/crypto/CryptoDetailSection";
import MarketOverview from "@/components/crypto/MarketOverview";

const COIN_POLL_INTERVAL_MS = 30_000;

interface Coin {
  symbol: string;
  name: string;
  price: number | null;
  change: number | null;
  percentChange: number | null;
  history: { time: number; value: number }[] | null;
}

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

// ---------------------------------------------------------------------
// Banner
// ---------------------------------------------------------------------

const BANNER_ICONS: Array<{
  Icon: LucideIcon;
  top: string;
  left: string;
  size: number;
  duration: string;
  delay: string;
  className: string;
}> = [
  { Icon: Bitcoin, top: "15%", left: "6%", size: 40, duration: "9s", delay: "0s", className: "text-amber-400/20" },
  { Icon: Coins, top: "65%", left: "12%", size: 32, duration: "11s", delay: "1.2s", className: "text-indigo-400/20" },
  { Icon: CircleDollarSign, top: "25%", left: "24%", size: 24, duration: "7.5s", delay: "0.6s", className: "text-emerald-400/20" },
  { Icon: Bitcoin, top: "70%", left: "34%", size: 28, duration: "10s", delay: "2s", className: "text-amber-400/15" },
  { Icon: Coins, top: "20%", left: "78%", size: 36, duration: "8.5s", delay: "0.8s", className: "text-indigo-400/20" },
  { Icon: Bitcoin, top: "62%", left: "86%", size: 44, duration: "12s", delay: "1.6s", className: "text-amber-400/20" },
  { Icon: CircleDollarSign, top: "78%", left: "68%", size: 26, duration: "9.5s", delay: "0.3s", className: "text-emerald-400/15" },
  { Icon: Coins, top: "12%", left: "92%", size: 30, duration: "10.5s", delay: "2.4s", className: "text-indigo-400/15" },
];

function CryptoBanner() {
  return (
    <div
      className="relative w-full overflow-hidden border-b border-white/10 bg-gradient-to-br from-neutral-950 via-indigo-950 to-neutral-950 bg-[length:200%_200%] animate-crypto-gradient"
      style={{ height: 176 }}
    >
      {BANNER_ICONS.map(({ Icon, top, left, size, duration, delay, className }, i) => (
        <Icon
          key={i}
          aria-hidden="true"
          className={`absolute animate-crypto-float ${className}`}
          style={{
            top,
            left,
            width: size,
            height: size,
            animationDuration: duration,
            animationDelay: delay,
          }}
        />
      ))}

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

function CoinCard({ coin }: { coin: Coin }) {
  const hasQuote = coin.price != null && coin.change != null && coin.percentChange != null;
  const isUp = hasQuote && coin.percentChange! > 0;
  const isDown = hasQuote && coin.percentChange! < 0;

  return (
    <div className="flex flex-col gap-3 rounded-md border border-black/10 p-4 dark:border-white/15">
      <div>
        <h3 className="font-semibold text-foreground">
          {coin.name} <span className="font-normal text-foreground/50">({coin.symbol})</span>
        </h3>
      </div>

      <div className="h-16 w-full">
        {coin.history && coin.history.length > 0 ? (
          <MiniLineChart data={coin.history} height={64} />
        ) : (
          <div className="h-full w-full animate-pulse rounded bg-foreground/10" />
        )}
      </div>

      <div className="flex flex-col gap-0.5">
        <span className="text-lg font-semibold text-foreground">
          {hasQuote ? formatCoinPrice(coin.price!) : "—"}
        </span>
        {hasQuote && (
          <span
            className={`text-xs font-medium ${
              isUp ? "text-green-500" : isDown ? "text-red-500" : "text-foreground/50"
            }`}
          >
            {isUp ? "▲" : isDown ? "▼" : ""} {formatCoinChange(coin.change!, coin.price!)} (
            {coin.percentChange! >= 0 ? "+" : ""}
            {coin.percentChange!.toFixed(2)}%)
          </span>
        )}
      </div>
    </div>
  );
}

function CoinGridSection() {
  const [coins, setCoins] = useState<Coin[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const response = await fetch("/api/crypto");
        if (!response.ok) {
          if (!cancelled && !hasLoadedRef.current) setError("Failed to load crypto prices");
          return;
        }
        const data = await response.json().catch(() => null);
        const list: Coin[] = Array.isArray(data?.coins) ? data.coins : [];
        if (cancelled || list.length === 0) return;
        hasLoadedRef.current = true;
        setError(null);
        setCoins(list);
      } catch {
        if (!cancelled && !hasLoadedRef.current) setError("Failed to load crypto prices");
      }
    }

    poll();
    const id = setInterval(poll, COIN_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return (
    <section className="flex w-full flex-col gap-4">
      <h2 className="text-xl font-bold text-foreground">Top 8 Most-Traded</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {coins === null &&
          !error &&
          Array.from({ length: 8 }).map((_, i) => <CoinCardSkeleton key={i} />)}

        {error && coins === null && (
          <p className="col-span-full text-sm text-red-500">{error}</p>
        )}

        {coins?.map((coin) => <CoinCard key={coin.symbol} coin={coin} />)}
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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {loading &&
          Array.from({ length: 6 }).map((_, i) => <ArticleCardSkeleton key={i} />)}

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

export default function CryptoPage() {
  return (
    <main className="flex flex-1 flex-col items-center gap-10 pb-10">
      <CryptoBanner />
      <div className="flex w-full max-w-6xl flex-col gap-10 px-8">
        <RevealOnScroll className="flex w-full flex-col items-center">
          <CryptoDetailSection />
        </RevealOnScroll>
        <MarketOverview />
        <RevealOnScroll>
          <CoinGridSection />
        </RevealOnScroll>
        <RevealOnScroll>
          <CryptoNewsSection />
        </RevealOnScroll>
      </div>
    </main>
  );
}
