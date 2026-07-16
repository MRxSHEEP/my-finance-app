import { NextRequest, NextResponse } from "next/server";
import {
  GRID_PAGE_SIZE,
  fetchAndCleanMarketaux,
  fetchAndCleanNewsApi,
  mergeArticleSources,
  type SourceResult,
} from "@/lib/newsApi";
import { withCache } from "@/lib/newsCache";

const PAGE_SIZE = String(GRID_PAGE_SIZE);

// NewsAPI's free tier is generous enough that this TTL is mostly a safety
// net against duplicate near-simultaneous requests (dev double-invocation,
// multiple tabs), not a real throttle on freshness.
const NEWSAPI_CACHE_TTL_MS = 60_000;

// Marketaux's free tier caps at 100 requests/day (and 3 articles/request,
// regardless of the requested limit) — far tighter than NewsAPI. Caching
// its contribution for longer means repeated grid loads within this
// window reuse the same fetch instead of spending quota again.
const MARKETAUX_CACHE_TTL_MS = 20 * 60_000;

export async function GET(request: NextRequest) {
  const pageParam = request.nextUrl.searchParams.get("page");
  const page = Math.max(1, Number.parseInt(pageParam ?? "1", 10) || 1);

  const newsApiKey = process.env.NEWSAPI_KEY;
  const marketauxKey = process.env.MARKETAUX_API_KEY;

  const [newsApiResult, marketauxResult] = await Promise.all([
    withCache(`grid:newsapi:${page}`, NEWSAPI_CACHE_TTL_MS, () =>
      fetchAndCleanNewsApi(newsApiKey, {
        sortBy: "publishedAt",
        language: "en",
        pageSize: PAGE_SIZE,
        page: String(page),
      })
    ),
    // Marketaux only returns 3 articles per request no matter what, so its
    // marginal contribution to deeper pages is tiny relative to its quota
    // cost — only spend it on the first page. Deeper "Load more" pages are
    // NewsAPI-only.
    page === 1
      ? withCache("grid:marketaux:1", MARKETAUX_CACHE_TTL_MS, () =>
          fetchAndCleanMarketaux(marketauxKey, { limit: "3", page: "1" })
        )
      : Promise.resolve<SourceResult>({ articles: [], ok: true }),
  ]);

  if (!newsApiResult.ok && !marketauxResult.ok) {
    return NextResponse.json(
      { error: "Both NewsAPI and Marketaux requests failed" },
      { status: 502 }
    );
  }

  const articles = mergeArticleSources(newsApiResult.articles, marketauxResult.articles);

  return NextResponse.json({ articles, page });
}
