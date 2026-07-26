"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import NewsTicker, { type Article } from "@/components/NewsTicker";
import {
  ArticleCard,
  ArticleCardSkeleton,
  CATEGORY_TAB_ACTIVE_STYLES,
  NEWS_CATEGORY_ORDER,
} from "@/components/ArticleCard";
import RevealOnScroll from "@/components/RevealOnScroll";

const TICKER_POLL_INTERVAL_MS = 150_000;

// "Markets" is a real category articles can be classified into (the
// catch-all for anything not more specifically Stocks/Crypto/Commodities/
// Earnings/Economy — see classifyCategory in lib/newsApi.ts), but it's
// deliberately not one of the tabs users pick from — only these 5 named
// categories, per spec. A "Markets"-tagged article is still visible (and
// still shows its badge) under "All"; it just has no dedicated tab.
const FILTER_TAB_CATEGORIES = NEWS_CATEGORY_ORDER.filter((c) => c !== "Markets");

type CategoryFilter = "All" | (typeof NEWS_CATEGORY_ORDER)[number];
const ROW_STAGGER_MS = 30;
const ROW_STAGGER_CAP = 8;

// This account's Marketaux plan caps every /api/news request at ≤3
// articles (see that route's own comment) regardless of the requested
// limit, so showing 15 articles immediately on load means fetching 5
// pages up front instead of 1. "Load more" continues from page 6 onward.
const INITIAL_PAGE_COUNT = 5;

// A selected category tab tops itself up to this many articles
// automatically (see the effect below), rather than only ever showing
// whatever happened to land in the initial 15/whatever's been Loaded so
// far. Fetched in small batches (TOPUP_BATCH_SIZE pages at a time) up to
// TOPUP_MAX_ADDITIONAL_PAGES beyond wherever the feed has already reached,
// stopping the moment the target is hit rather than always spending the
// full budget — and stopping early if a whole batch comes back empty,
// which means the 7-day recency window itself has run dry, not just this
// one category.
const CATEGORY_MIN_COUNT = 10;
const TOPUP_BATCH_SIZE = 3;
const TOPUP_MAX_ADDITIONAL_PAGES = 12;

function sortByRecency(articles: Article[]): Article[] {
  return [...articles].sort((a, b) => {
    const aTime = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
    const bTime = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
    return bTime - aTime;
  });
}

// Dedupes `incoming` against `existing` by URL and returns the combined,
// recency-sorted list — the same merge shape used by the initial load,
// "Load more", and the category top-up effect below, so all three ways of
// growing the pool behave identically.
function mergeArticles(existing: Article[], incoming: Article[]): Article[] {
  const seenUrls = new Set(existing.map((a) => a.url));
  const added: Article[] = [];
  for (const article of incoming) {
    if (seenUrls.has(article.url)) continue;
    seenUrls.add(article.url);
    added.push(article);
  }
  return added.length > 0 ? sortByRecency([...existing, ...added]) : existing;
}

// Always renders every tab (All + all 6 categories) — not conditioned on
// which categories happen to have articles loaded yet, so the full set is
// visible and clickable immediately, before the grid has even finished its
// first fetch. Selecting a thin/empty-so-far category is exactly what
// triggers its own top-up fetch (see the effect in NewsPage below), so a
// tab with nothing loaded yet isn't a dead end — it's the normal way to
// ask for that category's articles in the first place.
function FilterTabs({
  active,
  onSelect,
}: {
  active: CategoryFilter;
  onSelect: (filter: CategoryFilter) => void;
}) {
  return (
    <div className="flex w-full max-w-3xl flex-wrap gap-1.5">
      <button
        type="button"
        onClick={() => onSelect("All")}
        className={`rounded-md px-3 py-1.5 text-sm font-medium transition-all duration-200 ease-out active:scale-95 ${
          active === "All" ? "bg-foreground text-background" : "text-foreground/60 hover:bg-foreground/5 hover:text-foreground"
        }`}
      >
        All
      </button>
      {FILTER_TAB_CATEGORIES.map((category) => (
        <button
          key={category}
          type="button"
          onClick={() => onSelect(category)}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-all duration-200 ease-out active:scale-95 ${
            active === category
              ? CATEGORY_TAB_ACTIVE_STYLES[category]
              : "text-foreground/60 hover:bg-foreground/5 hover:text-foreground"
          }`}
        >
          {category}
        </button>
      ))}
    </div>
  );
}

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
  // True when at least one of the initial pages served last-known-good
  // cached articles instead of a fresh fetch (rate limit/outage) —
  // distinct from gridError, which is reserved for a total failure with
  // nothing left to show at all.
  const [gridStale, setGridStale] = useState(false);
  const [gridDegraded, setGridDegraded] = useState(false);
  const [gridLoading, setGridLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMoreGrid, setHasMoreGrid] = useState(true);
  const gridArticlesRef = useRef<Article[]>([]);
  const gridPageRef = useRef(1);

  const [tickerPool, setTickerPool] = useState<Article[]>([]);
  const seenTickerUrlsRef = useRef<Set<string>>(new Set());

  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("All");
  const filteredArticles = useMemo(() => {
    if (!articles) return [];
    if (categoryFilter === "All") return articles;
    return articles.filter((a) => a.category === categoryFilter);
  }, [articles, categoryFilter]);

  const [categoryLoadingMore, setCategoryLoadingMore] = useState(false);

  async function handleLoadMore() {
    if (loadingMore || categoryLoadingMore || !hasMoreGrid) return;

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

      const merged = mergeArticles(gridArticlesRef.current, list);
      gridArticlesRef.current = merged;
      gridPageRef.current = nextPage;
      setArticles(merged);
    } catch {
      // Transient failure — the user can just click "Load more" again.
    } finally {
      setLoadingMore(false);
    }
  }

  // Tops a selected category tab up to CATEGORY_MIN_COUNT automatically —
  // fetching further pages beyond wherever the feed has already reached
  // (continuing the same page sequence "Load more" uses, so nothing is
  // fetched twice and every tab benefits from whatever gets pulled in
  // along the way) until the target is hit, the fetch cap is reached, or
  // the underlying feed genuinely has nothing more to give.
  useEffect(() => {
    if (categoryFilter === "All" || gridLoading) return;

    const alreadyHave = gridArticlesRef.current.filter((a) => a.category === categoryFilter).length;
    if (alreadyHave >= CATEGORY_MIN_COUNT) return;

    let cancelled = false;

    async function topUp() {
      setCategoryLoadingMore(true);
      let pagesFetched = 0;

      while (!cancelled && pagesFetched < TOPUP_MAX_ADDITIONAL_PAGES) {
        const currentCount = gridArticlesRef.current.filter((a) => a.category === categoryFilter).length;
        if (currentCount >= CATEGORY_MIN_COUNT) break;

        const batchSize = Math.min(TOPUP_BATCH_SIZE, TOPUP_MAX_ADDITIONAL_PAGES - pagesFetched);
        const batchStart = gridPageRef.current + 1;
        const batchPages = Array.from({ length: batchSize }, (_, i) => batchStart + i);

        const results = await Promise.all(
          batchPages.map(async (p) => {
            try {
              const res = await fetch(`/api/news?page=${p}`);
              const body = await res.json().catch(() => null);
              return { ok: res.ok, body };
            } catch {
              return { ok: false, body: null };
            }
          })
        );

        if (cancelled) return;

        pagesFetched += batchPages.length;
        gridPageRef.current = batchPages[batchPages.length - 1];

        let addedAny = false;
        for (const { ok, body } of results) {
          if (!ok) continue;
          const list: Article[] = Array.isArray(body?.articles) ? body.articles : [];
          if (list.length === 0) continue;
          const merged = mergeArticles(gridArticlesRef.current, list);
          if (merged !== gridArticlesRef.current) addedAny = true;
          gridArticlesRef.current = merged;
        }

        if (addedAny) setArticles(gridArticlesRef.current);

        // A whole batch with nothing new means the 7-day recency window
        // has genuinely run dry, not just this one category — further
        // attempts (for any tab) would just waste calls.
        if (!addedAny) {
          setHasMoreGrid(false);
          break;
        }
      }

      if (!cancelled) setCategoryLoadingMore(false);
    }

    topUp();

    return () => {
      cancelled = true;
      setCategoryLoadingMore(false);
    };
  }, [categoryFilter, gridLoading]);

  useEffect(() => {
    let cancelled = false;
    let pollInterval: ReturnType<typeof setInterval> | undefined;

    async function loadGrid() {
      setGridLoading(true);
      setGridError(null);
      setGridDegraded(false);

      try {
        // Fetch the first INITIAL_PAGE_COUNT pages in parallel so 15
        // articles (5 pages × ≤3 each) are visible on first paint without
        // requiring a "Load more" click. Each page is independently cached
        // server-side (GRID_CACHE_TTL_MS), so repeat visits within that
        // window cost nothing extra.
        const pageNumbers = Array.from({ length: INITIAL_PAGE_COUNT }, (_, i) => i + 1);
        const results = await Promise.all(
          pageNumbers.map(async (p) => {
            const res = await fetch(`/api/news?page=${p}`);
            const body = await res.json().catch(() => null);
            return { ok: res.ok, body };
          })
        );

        if (cancelled) return;

        // A page now always resolves 200 even when Marketaux failed
        // upstream — a real fetch failure with nothing cached to fall
        // back on shows up as `body.degraded` with an empty article list,
        // not a non-200 status. One thin/degraded page (rate limit,
        // transient error) shouldn't blank the whole feed when others
        // came back with real (fresh or stale) articles.
        let combined: Article[] = [];
        let anyStale = false;
        let anyArticles = false;
        for (const { ok, body } of results) {
          if (!ok) continue;
          const list: Article[] = Array.isArray(body?.articles) ? body.articles : [];
          if (list.length > 0) anyArticles = true;
          if (body?.stale) anyStale = true;
          combined = mergeArticles(combined, list);
        }

        if (!anyArticles) {
          setGridDegraded(true);
          setArticles([]);
          gridArticlesRef.current = [];
          setHasMoreGrid(false);
          return;
        }

        gridArticlesRef.current = combined;
        gridPageRef.current = INITIAL_PAGE_COUNT;
        setArticles(combined);
        setGridStale(anyStale);
        setHasMoreGrid(combined.length > 0);
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

      <FilterTabs active={categoryFilter} onSelect={setCategoryFilter} />

      <div className="flex w-full max-w-3xl flex-col">
        {gridLoading &&
          Array.from({ length: 15 }).map((_, i) => (
            <ArticleCardSkeleton key={i} />
          ))}

        {!gridLoading && gridError && (
          <p className="text-sm text-red-500">{gridError}</p>
        )}

        {!gridLoading && !gridError && gridStale && (
          <p className="mb-2 text-xs font-medium text-amber-500">
            Showing recent headlines — live updates paused
          </p>
        )}

        {!gridLoading && !gridError && articles && articles.length === 0 && (
          <p className="text-sm text-foreground/60">
            {gridDegraded ? "Live news is temporarily unavailable — check back soon." : "No articles found."}
          </p>
        )}

        {!gridLoading &&
          !gridError &&
          articles &&
          articles.length > 0 &&
          filteredArticles.length === 0 &&
          !categoryLoadingMore && (
            <p className="py-6 text-sm text-foreground/60">
              No {categoryFilter} articles found in the last 7 days.
            </p>
          )}

        {!gridLoading &&
          !gridError &&
          filteredArticles.map((article, index) => (
            <RevealOnScroll key={`${article.url}-${index}`} delayMs={(index % ROW_STAGGER_CAP) * ROW_STAGGER_MS}>
              <ArticleCard article={article} />
            </RevealOnScroll>
          ))}

        {/* While a category tab is topping itself up toward
            CATEGORY_MIN_COUNT, show trailing skeleton rows for the
            remaining slots rather than an empty-looking gap or a
            premature "nothing found" message. */}
        {!gridLoading &&
          !gridError &&
          categoryLoadingMore &&
          Array.from({ length: Math.max(0, CATEGORY_MIN_COUNT - filteredArticles.length) }).map((_, i) => (
            <ArticleCardSkeleton key={`topup-${i}`} />
          ))}

        {!gridLoading &&
          !gridError &&
          !categoryLoadingMore &&
          categoryFilter !== "All" &&
          filteredArticles.length > 0 &&
          filteredArticles.length < CATEGORY_MIN_COUNT && (
            <p className="py-3 text-center text-xs text-foreground/50">
              Showing all {filteredArticles.length} {categoryFilter} articles available from the last 7 days.
            </p>
          )}
      </div>

      {!gridLoading && !gridError && articles && articles.length > 0 && hasMoreGrid && (
        <button
          type="button"
          onClick={handleLoadMore}
          disabled={loadingMore || categoryLoadingMore}
          className="rounded-md border border-black/10 px-4 py-2 text-sm font-medium text-foreground/60 hover:text-foreground disabled:opacity-50 dark:border-white/15"
        >
          {loadingMore ? "Loading…" : "Load more"}
        </button>
      )}
    </main>
  );
}
