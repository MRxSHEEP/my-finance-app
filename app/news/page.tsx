"use client";

import { useEffect, useRef, useState } from "react";
import NewsTicker, { type Article } from "@/components/NewsTicker";
import { ArticleCard, ArticleCardSkeleton } from "@/components/ArticleCard";

const TICKER_POLL_INTERVAL_MS = 150_000;

// Builds the ticker's rotation pool from the most-recent (already grid-
// deduped) articles, putting any article not in `seenUrls` at the front so
// breaking news surfaces on the very next rotation instead of waiting for
// its natural recency order. Mutates `seenUrls` in place to record
// everything in the new pool.
function computeTickerPool(articles: Article[], seenUrls: Set<string>): Article[] {
  const sorted = [...articles].sort((a, b) => {
    const aTime = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
    const bTime = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
    return bTime - aTime;
  });

  const newOnes = sorted.filter((a) => !seenUrls.has(a.url));
  const rest = sorted.filter((a) => seenUrls.has(a.url));

  sorted.forEach((a) => seenUrls.add(a.url));

  return [...newOnes, ...rest];
}

export default function NewsPage() {
  const [articles, setArticles] = useState<Article[] | null>(null);
  const [gridError, setGridError] = useState<string | null>(null);
  const [gridLoading, setGridLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMoreGrid, setHasMoreGrid] = useState(true);
  const gridArticlesRef = useRef<Article[]>([]);
  const gridPageRef = useRef(1);

  const [tickerPool, setTickerPool] = useState<Article[]>([]);
  const seenTickerUrlsRef = useRef<Set<string>>(new Set());

  async function handleLoadMore() {
    if (loadingMore || !hasMoreGrid) return;

    setLoadingMore(true);
    const nextPage = gridPageRef.current + 1;

    try {
      const res = await fetch(`/api/news?page=${nextPage}`);
      const body = await res.json();

      if (!res.ok) {
        setHasMoreGrid(false);
        return;
      }

      const list: Article[] = Array.isArray(body.articles) ? body.articles : [];
      if (list.length === 0) {
        setHasMoreGrid(false);
        return;
      }

      const existingUrls = new Set(gridArticlesRef.current.map((a) => a.url));
      const deduped = list.filter((a) => !existingUrls.has(a.url));
      const merged = [...gridArticlesRef.current, ...deduped];

      gridArticlesRef.current = merged;
      gridPageRef.current = nextPage;
      setArticles(merged);
    } catch {
      // Transient failure — the user can just click "Load more" again.
    } finally {
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    let pollInterval: ReturnType<typeof setInterval> | undefined;

    async function loadGrid() {
      setGridLoading(true);
      setGridError(null);

      try {
        const res = await fetch("/api/news?page=1");
        const body = await res.json();

        if (cancelled) return;

        if (!res.ok) {
          setGridError(body.error ?? "Failed to load news");
          setArticles(null);
          gridArticlesRef.current = [];
          return;
        }

        const list: Article[] = Array.isArray(body.articles) ? body.articles : [];
        gridArticlesRef.current = list;
        gridPageRef.current = 1;
        setArticles(list);
        setHasMoreGrid(list.length > 0);
      } catch {
        if (!cancelled) {
          setGridError("Failed to load news");
          setArticles(null);
          gridArticlesRef.current = [];
        }
      } finally {
        if (!cancelled) setGridLoading(false);
      }
    }

    async function loadTicker() {
      try {
        const res = await fetch("/api/news/ticker");
        const body = await res.json();

        if (cancelled || !res.ok) return;

        const list: Article[] = Array.isArray(body.articles) ? body.articles : [];
        const gridUrls = new Set(gridArticlesRef.current.map((a) => a.url));
        const deduped = list.filter((a) => !gridUrls.has(a.url));

        setTickerPool(computeTickerPool(deduped, seenTickerUrlsRef.current));
      } catch {
        // Transient failure — keep showing the existing ticker pool.
      }
    }

    // The grid loads first so the ticker's grid-URL exclusion set is
    // populated before its first fetch, guaranteeing no overlap even on
    // the very first paint (not just on later polls).
    async function init() {
      await loadGrid();
      if (cancelled) return;

      await loadTicker();
      if (cancelled) return;

      pollInterval = setInterval(loadTicker, TICKER_POLL_INTERVAL_MS);
    }

    init();

    return () => {
      cancelled = true;
      if (pollInterval) clearInterval(pollInterval);
    };
  }, []);

  return (
    <main className="flex flex-1 flex-col items-center gap-6 p-8 pt-16">
      <h1 className="text-3xl font-bold text-foreground">News</h1>

      {tickerPool.length > 0 && <NewsTicker articles={tickerPool} />}

      <div className="grid w-full max-w-5xl grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {gridLoading &&
          Array.from({ length: 6 }).map((_, i) => (
            <ArticleCardSkeleton key={i} />
          ))}

        {!gridLoading && gridError && (
          <p className="col-span-full text-sm text-red-500">{gridError}</p>
        )}

        {!gridLoading && !gridError && articles && articles.length === 0 && (
          <p className="col-span-full text-sm text-foreground/60">
            No articles found.
          </p>
        )}

        {!gridLoading &&
          !gridError &&
          articles?.map((article, index) => (
            <ArticleCard key={`${article.url}-${index}`} article={article} />
          ))}
      </div>

      {!gridLoading && !gridError && articles && articles.length > 0 && hasMoreGrid && (
        <button
          type="button"
          onClick={handleLoadMore}
          disabled={loadingMore}
          className="rounded-md border border-black/10 px-4 py-2 text-sm font-medium text-foreground/60 hover:text-foreground disabled:opacity-50 dark:border-white/15"
        >
          {loadingMore ? "Loading…" : "Load more"}
        </button>
      )}
    </main>
  );
}
