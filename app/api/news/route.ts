import { NextRequest, NextResponse } from "next/server";
import {
  classifyAndStripEntityTypes,
  dedupeAndSortArticles,
  fetchAndCleanMarketaux,
  filterRecentArticles,
  GRID_CACHE_TTL_MS,
  isFromWireService,
  MAJOR_CRYPTO_SYMBOLS,
  MAJOR_STOCK_SYMBOLS,
  MAX_ARTICLE_AGE_MS,
  toMarketauxDate,
  type NewsArticle,
} from "@/lib/newsApi";
import { withCacheAndFallback } from "@/lib/newsCache";
import { fetchGeneratedArticles } from "@/lib/generatedNews/feedMerge";

// Broad cross-market feed, not stock-only — combining both symbol sets in
// one call (rather than a second request) is what lets Crypto articles
// show up here at all, at zero added Marketaux quota cost (this account's
// plan is capped at 100 requests/day total, shared across every consumer
// in the app — confirmed live via the response's own `x-usagelimit-*`
// headers — so a second query per category is not an option here).
const GENERAL_FEED_SYMBOLS = `${MAJOR_STOCK_SYMBOLS},${MAJOR_CRYPTO_SYMBOLS}`;

// This route itself just serves one page (≤3 articles) at a time — the
// "show 15 immediately, no click required" behavior lives client-side in
// app/news/page.tsx, which fetches pages 1-5 in parallel on first load and
// merges them. "Load more" beyond that continues from page 6 onward, one
// page (≤3 articles) per click, same as before.
export async function GET(request: NextRequest) {
  const pageParam = request.nextUrl.searchParams.get("page");
  const page = Math.max(1, Number.parseInt(pageParam ?? "1", 10) || 1);

  const marketauxKey = process.env.MARKETAUX_API_KEY;

  // Deeper "Load more" pages can legitimately come back thinner (or
  // empty) once the last-7-days matching pool runs out, rather than
  // reaching back into arbitrarily old relevance-ranked results.
  const fromIso = toMarketauxDate(new Date(Date.now() - MAX_ARTICLE_AGE_MS));

  // Marketaux's own entity recognition (symbols + must_have_entities)
  // replaces the old NewsAPI-oriented boolean keyword query — the
  // curated large-cap/index set below is the one editorial call left,
  // same as every other feed now consolidated onto this provider.
  //
  // `limit: "20"` is requested but NOT actually honored — live-confirmed
  // (via the response's own `meta.limit`/`meta.returned`) that this
  // account's Marketaux plan caps every request at exactly 3 articles
  // regardless of the requested limit, the same account-wide constraint
  // already documented in app/api/commodities/news/route.ts for its
  // search-based query. So each "Load more" page genuinely only adds 3
  // new articles, not 20 — kept at "20" here (rather than hardcoding "3")
  // so this starts returning more automatically if the plan is ever
  // upgraded, without a code change.
  const { data: marketauxResult, stale, staleFetchedAt } = await withCacheAndFallback(
    `grid:marketaux:${page}`,
    GRID_CACHE_TTL_MS,
    () =>
      fetchAndCleanMarketaux(marketauxKey, {
        symbols: GENERAL_FEED_SYMBOLS,
        must_have_entities: "true",
        filter_entities: "true",
        limit: "20",
        page: String(page),
        published_after: fromIso,
      }),
    (result) => result.ok,
    true
  );

  if (!marketauxResult.ok && !stale) {
    return NextResponse.json({ articles: [], page, degraded: true });
  }

  // Real per-article categorization (Stocks/Crypto/Commodities/Earnings/
  // Economy/Markets) instead of the flat "Markets" label every article
  // used to get — see classifyCategory in lib/newsApi.ts. entityTypes is
  // stripped afterward: it's an internal classification input, not
  // something the client needs on the wire.
  let articles: NewsArticle[] = dedupeAndSortArticles(filterRecentArticles(marketauxResult.articles))
    .filter((a) => !isFromWireService(a))
    .map(classifyAndStripEntityTypes);

  // Every published Noble Generated News article merges into page 1 only
  // — this route has no per-page result cap (unlike app/api/stock|crypto/
  // news's RESULT_COUNT), so nothing here risks being pushed out by a
  // fuller page, and app/news/page.tsx fetches page 1 on every load,
  // guaranteeing these are present in `articles` (and therefore visible
  // under every category tab that filters it) without needing to touch
  // "Load more"'s pagination/dedup logic on later pages.
  if (page === 1) {
    const generated = await fetchGeneratedArticles();
    articles = dedupeAndSortArticles([...articles, ...generated]);
  }

  return NextResponse.json({ articles, page, stale, staleFetchedAt });
}
