import { NextResponse } from "next/server";
import {
  GRID_PAGE_SIZE,
  fetchAndCleanMarketaux,
  fetchAndCleanNewsApi,
  mergeArticleSources,
  type NewsArticle,
} from "@/lib/newsApi";
import { withCache } from "@/lib/newsCache";

const TICKER_PAGE_SIZE = 10;

// The grid and ticker query the same NewsAPI corpus with the same sort, so
// without an offset the ticker's "most recent" results would just be a
// subset of the grid's first page — the client-side dedup against the
// grid would then strip all of them, leaving an empty ticker. Requesting
// a page past the grid's own first-page window keeps the two structurally
// distinct instead of relying on dedup alone to fix up a fully-overlapping
// result set.
const NEWSAPI_TICKER_OFFSET_PAGE = String(
  Math.floor(GRID_PAGE_SIZE / TICKER_PAGE_SIZE) + 1
);

// Marketaux always returns 3 articles/request regardless of `limit`. The
// grid's Marketaux fetch always uses page 1, so the ticker uses a
// different page to avoid pulling the exact same 3 articles.
const MARKETAUX_TICKER_LIMIT = "3";
const MARKETAUX_TICKER_PAGE = "5";

// See app/api/news/route.ts for why these differ so much: NewsAPI's TTL is
// mostly a de-dup safety net, Marketaux's protects its 100-requests/day cap.
const NEWSAPI_CACHE_TTL_MS = 60_000;
const MARKETAUX_CACHE_TTL_MS = 20 * 60_000;

function isSameUtcDay(dateStr: string, reference: Date): boolean {
  const d = new Date(dateStr);
  return (
    d.getUTCFullYear() === reference.getUTCFullYear() &&
    d.getUTCMonth() === reference.getUTCMonth() &&
    d.getUTCDate() === reference.getUTCDate()
  );
}

async function loadNewsApiTicker(): Promise<NewsArticle[]> {
  const apiKey = process.env.NEWSAPI_KEY;
  const now = new Date();
  const todayIso = now.toISOString().slice(0, 10);

  const todayResult = await fetchAndCleanNewsApi(apiKey, {
    sortBy: "publishedAt",
    language: "en",
    pageSize: String(TICKER_PAGE_SIZE),
    page: NEWSAPI_TICKER_OFFSET_PAGE,
    from: todayIso,
  });

  const todayOnly = todayResult.articles.filter(
    (a) => a.publishedAt && isSameUtcDay(a.publishedAt, now)
  );
  if (todayOnly.length > 0) return todayOnly;

  // No articles published today yet — fall back to the most recent
  // available rather than showing an empty ticker.
  const fallbackResult = await fetchAndCleanNewsApi(apiKey, {
    sortBy: "publishedAt",
    language: "en",
    pageSize: String(TICKER_PAGE_SIZE),
    page: NEWSAPI_TICKER_OFFSET_PAGE,
  });
  return fallbackResult.articles;
}

async function loadMarketauxTicker(): Promise<NewsArticle[]> {
  const apiKey = process.env.MARKETAUX_API_KEY;
  const now = new Date();
  const todayIso = now.toISOString().slice(0, 10);

  const todayResult = await fetchAndCleanMarketaux(apiKey, {
    limit: MARKETAUX_TICKER_LIMIT,
    page: MARKETAUX_TICKER_PAGE,
    // Marketaux needs a full timestamp here — a bare date returns 0 results.
    published_after: `${todayIso}T00:00:00`,
  });

  const todayOnly = todayResult.articles.filter(
    (a) => a.publishedAt && isSameUtcDay(a.publishedAt, now)
  );
  if (todayOnly.length > 0) return todayOnly;

  const fallbackResult = await fetchAndCleanMarketaux(apiKey, {
    limit: MARKETAUX_TICKER_LIMIT,
    page: MARKETAUX_TICKER_PAGE,
  });
  return fallbackResult.articles;
}

export async function GET() {
  const newsApiKey = process.env.NEWSAPI_KEY;
  const marketauxKey = process.env.MARKETAUX_API_KEY;

  if (!newsApiKey && !marketauxKey) {
    return NextResponse.json(
      { error: "Server is missing both NEWSAPI_KEY and MARKETAUX_API_KEY configuration" },
      { status: 500 }
    );
  }

  const [newsApiArticles, marketauxArticles] = await Promise.all([
    withCache("ticker:newsapi", NEWSAPI_CACHE_TTL_MS, loadNewsApiTicker),
    withCache("ticker:marketaux", MARKETAUX_CACHE_TTL_MS, loadMarketauxTicker),
  ]);

  const articles = mergeArticleSources(newsApiArticles, marketauxArticles);

  return NextResponse.json({ articles });
}
