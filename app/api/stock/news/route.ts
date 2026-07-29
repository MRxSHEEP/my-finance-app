import { NextResponse } from "next/server";
import {
  dedupeSimilarTitles,
  fetchAndCleanMarketaux,
  filterRecentArticles,
  isEnglishScript,
  isFromWireService,
  dedupeAndSortArticles,
  FALLBACK_WINDOW_MS,
  MAJOR_STOCK_SYMBOLS,
  MARKETAUX_CACHE_TTL_MS,
  toMarketauxDate,
  type NewsArticle,
  type SourceResult,
} from "@/lib/newsApi";
import { withCacheAndFallback } from "@/lib/newsCache";
import { fetchGeneratedArticleForTicker, fetchGeneratedArticles, withGuaranteedGeneratedArticle } from "@/lib/generatedNews/feedMerge";

export const dynamic = "force-dynamic";

const RESULT_COUNT = 9;

function isSameUtcDay(dateStr: string, reference: Date): boolean {
  const d = new Date(dateStr);
  return (
    d.getUTCFullYear() === reference.getUTCFullYear() &&
    d.getUTCMonth() === reference.getUTCMonth() &&
    d.getUTCDate() === reference.getUTCDate()
  );
}

// Marketaux's own entity recognition is the relevance mechanism now —
// `symbols` matches articles by recognized ticker entity and
// `must_have_entities`/`filter_entities` keep the result set to genuinely
// tagged coverage, replacing the old company-name/whole-word title
// matching this route used to hand-roll for NewsAPI's benefit (NewsAPI
// had no concept of "this article is about ticker X" on its own).
async function loadMarketaux(symbols: string): Promise<SourceResult> {
  const apiKey = process.env.MARKETAUX_API_KEY;
  const now = new Date();
  const todayIso = now.toISOString().slice(0, 10);
  const baseParams = { symbols, must_have_entities: "true", filter_entities: "true", limit: "20" };

  const todayResult = await fetchAndCleanMarketaux(apiKey, {
    ...baseParams,
    published_after: `${todayIso}T00:00:00`,
  });

  const todayOnly = todayResult.articles.filter(
    (a) => a.publishedAt && isSameUtcDay(a.publishedAt, now)
  );
  if (todayOnly.length > 0) return { articles: todayOnly, ok: todayResult.ok };

  // Widen to the last FALLBACK_WINDOW_MS (72h) rather than showing
  // nothing — bounded, not the unbounded "whatever's most recent" fetch
  // that previously let month-old articles slip in once the fresh pool
  // ran dry.
  const fallbackResult = await fetchAndCleanMarketaux(apiKey, {
    ...baseParams,
    published_after: toMarketauxDate(new Date(now.getTime() - FALLBACK_WINDOW_MS)),
  });
  return { articles: fallbackResult.articles, ok: todayResult.ok || fallbackResult.ok };
}

export async function GET(request: Request) {
  const marketauxKey = process.env.MARKETAUX_API_KEY;

  if (!marketauxKey) {
    return NextResponse.json(
      { error: "Server is missing MARKETAUX_API_KEY configuration" },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(request.url);
  const ticker = searchParams.get("ticker")?.trim().toUpperCase() || null;

  // Ticker-specific mode narrows to just that company's own symbol;
  // general mode uses the shared large-cap set — both rely on Marketaux's
  // native entity match rather than any text/keyword anchor.
  const symbols = ticker || MAJOR_STOCK_SYMBOLS;
  const cacheKey = ticker ?? "general";

  const { data: marketauxResult, stale, staleFetchedAt } = await withCacheAndFallback(
    `stock-news:marketaux:${cacheKey}`,
    MARKETAUX_CACHE_TTL_MS,
    () => loadMarketaux(symbols),
    (result) => result.ok,
    true
  );

  // Nothing live and nothing cached to fall back to yet — a genuinely
  // degraded state, not a raw upstream error string. The real cause
  // (rate limit/auth/server/network) is in marketauxResult.errorDetail,
  // already logged server-side by fetchAndCleanMarketaux.
  if (!marketauxResult.ok && !stale) {
    return NextResponse.json({ articles: [], degraded: true });
  }

  const realArticles: NewsArticle[] = dedupeSimilarTitles(
    dedupeAndSortArticles(filterRecentArticles(marketauxResult.articles))
  )
    .filter((a) => !isFromWireService(a))
    .filter(isEnglishScript)
    .map((article) => ({ ...article, category: "Stocks" }));

  // Ticker-specific mode merges in just that ticker's own Noble Generated
  // News article (if one exists); general mode merges in every published
  // stock one — see lib/generatedNews/feedMerge.ts.
  const generated = ticker
    ? await fetchGeneratedArticleForTicker("stock", ticker).then((a) => (a ? [a] : []))
    : await fetchGeneratedArticles("stock");

  const pool = dedupeAndSortArticles([...realArticles, ...generated]);
  const articles = withGuaranteedGeneratedArticle(pool, RESULT_COUNT);

  return NextResponse.json({ articles, stale, staleFetchedAt });
}
