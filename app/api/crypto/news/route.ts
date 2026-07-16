import { NextResponse } from "next/server";
import {
  fetchAndCleanMarketaux,
  fetchAndCleanNewsApi,
  mergeArticleSources,
} from "@/lib/newsApi";
import { withCache } from "@/lib/newsCache";

// fetchAndCleanNewsApi/fetchAndCleanMarketaux both build their query params
// as `{ ...defaultQuery, ...params }`, so passing `q`/`search` here
// overrides the general-market default query from lib/newsApi.ts (used by
// /api/news) without needing to touch that shared module.
const CRYPTO_NEWS_QUERY = "bitcoin OR ethereum OR cryptocurrency OR crypto market";
const PAGE_SIZE = "9";

// Same TTL reasoning as app/api/news/route.ts: NewsAPI's is mostly a
// de-dup safety net, Marketaux's protects its 100-requests/day cap.
const NEWSAPI_CACHE_TTL_MS = 60_000;
const MARKETAUX_CACHE_TTL_MS = 20 * 60_000;

export async function GET() {
  const newsApiKey = process.env.NEWSAPI_KEY;
  const marketauxKey = process.env.MARKETAUX_API_KEY;

  const [newsApiResult, marketauxResult] = await Promise.all([
    withCache("crypto:newsapi", NEWSAPI_CACHE_TTL_MS, () =>
      fetchAndCleanNewsApi(newsApiKey, {
        q: CRYPTO_NEWS_QUERY,
        sortBy: "publishedAt",
        language: "en",
        pageSize: PAGE_SIZE,
        page: "1",
      })
    ),
    withCache("crypto:marketaux", MARKETAUX_CACHE_TTL_MS, () =>
      fetchAndCleanMarketaux(marketauxKey, {
        search: CRYPTO_NEWS_QUERY,
        limit: "3",
        page: "1",
      })
    ),
  ]);

  if (!newsApiResult.ok && !marketauxResult.ok) {
    return NextResponse.json(
      { error: "Both NewsAPI and Marketaux requests failed" },
      { status: 502 }
    );
  }

  const articles = mergeArticleSources(newsApiResult.articles, marketauxResult.articles);

  return NextResponse.json({ articles });
}
