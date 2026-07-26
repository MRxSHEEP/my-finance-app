"use client";

import { useEffect, useState } from "react";
import type { Article } from "@/components/NewsTicker";
import { ArticleCard, ArticleCardSkeleton } from "@/components/ArticleCard";

const ARTICLE_COUNT = 9;
// Matches the main /news page's ticker poll cadence — frequent enough to
// feel genuinely live, gentle enough to stay well under both providers'
// rate limits given their own cache TTLs server-side.
const POLL_INTERVAL_MS = 150_000;

interface StockNewsSectionProps {
  // When provided, this instance becomes the ticker-specific feed shown
  // on that company's own Deep Dive tab (prioritizing articles about that
  // company specifically) rather than the general large-cap/big-tech
  // feed — same split as crypto's general vs. (future) coin-specific news.
  // Marketaux resolves the ticker to its own recognized entity server-
  // side, so no company display name needs to be passed along anymore.
  ticker?: string;
}

export default function StockNewsSection({ ticker }: StockNewsSectionProps) {
  const [articles, setArticles] = useState<Article[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Set when the server served last-known-good cached articles instead of
  // a fresh Marketaux fetch (rate limit/outage) — distinct from `error`,
  // which is reserved for a genuine, nothing-to-show failure.
  const [stale, setStale] = useState(false);
  const [degraded, setDegraded] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let pollInterval: ReturnType<typeof setInterval> | undefined;

    const url = ticker ? `/api/stock/news?ticker=${encodeURIComponent(ticker)}` : "/api/stock/news";

    // `isPoll` skips the loading-skeleton flash on background refreshes —
    // only the very first load should show the loading state.
    async function load(isPoll: boolean) {
      if (!isPoll) setLoading(true);
      if (!isPoll) setError(null);

      try {
        const response = await fetch(url);
        const body = await response.json();

        if (cancelled) return;

        if (!response.ok) {
          if (!isPoll) {
            setError(body.error ?? "Failed to load stock news");
            setArticles(null);
          }
          return;
        }

        setArticles(Array.isArray(body.articles) ? body.articles.slice(0, ARTICLE_COUNT) : []);
        setStale(Boolean(body.stale));
        setDegraded(Boolean(body.degraded));
        setError(null);
      } catch {
        if (!cancelled && !isPoll) {
          setError("Failed to load stock news");
          setArticles(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    async function init() {
      await load(false);
      if (cancelled) return;
      pollInterval = setInterval(() => load(true), POLL_INTERVAL_MS);
    }

    init();
    return () => {
      cancelled = true;
      if (pollInterval) clearInterval(pollInterval);
    };
    // Re-fetches from scratch whenever the selected ticker changes — this
    // component is remounted per-ticker on the stocks page (`key={activeTicker}`
    // upstream), but guarding on the prop directly here too keeps this
    // component correct even if a future caller doesn't remount it.
  }, [ticker]);

  const heading = ticker ? `${ticker} News` : "Recent Stock News";

  return (
    <section className="flex w-full flex-col gap-4">
      <h2 className="text-xl font-bold text-foreground">{heading}</h2>
      <div className="flex w-full flex-col">
        {loading && Array.from({ length: ARTICLE_COUNT }).map((_, i) => <ArticleCardSkeleton key={i} />)}

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
