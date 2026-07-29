import { NextResponse } from "next/server";
import {
  dedupeAndSortArticles,
  dedupeSimilarTitles,
  FALLBACK_WINDOW_MS,
  fetchAndCleanMarketaux,
  filterRecentArticles,
  isEnglishScript,
  isFromWireService,
  MAJOR_CRYPTO_SYMBOLS,
  MARKETAUX_CACHE_TTL_MS,
  toMarketauxDate,
  type NewsArticle,
} from "@/lib/newsApi";
import { withCacheAndFallback } from "@/lib/newsCache";
import { fetchGeneratedArticles, withGuaranteedGeneratedArticle } from "@/lib/generatedNews/feedMerge";

export const dynamic = "force-dynamic";

// A cap, not a target — fewer genuinely relevant articles is preferred
// over padding this out with anything weaker just to hit a round number.
const RESULT_COUNT = 9;

function isSameUtcDay(dateStr: string, reference: Date): boolean {
  const d = new Date(dateStr);
  return (
    d.getUTCFullYear() === reference.getUTCFullYear() &&
    d.getUTCMonth() === reference.getUTCMonth() &&
    d.getUTCDate() === reference.getUTCDate()
  );
}

// Marketaux's own entity recognition does the relevance work now:
// `symbols` matches the curated major-coin list by recognized entity,
// `entity_types=cryptocurrency` keeps matches scoped to crypto entities
// specifically (not e.g. a stock ticker that happens to collide with a
// coin symbol), and `must_have_entities`/`filter_entities` keep the
// result set to genuinely tagged coverage — replacing the old
// CRYPTO_STRONG_CONFIRMATION_TERMS/NON_CRYPTO_NOISE_TERMS title-keyword
// pipeline this route used to hand-roll for NewsAPI's benefit.
async function loadMarketaux(): Promise<{ articles: NewsArticle[]; ok: boolean }> {
  const apiKey = process.env.MARKETAUX_API_KEY;
  const now = new Date();
  const todayIso = now.toISOString().slice(0, 10);
  const baseParams = {
    symbols: MAJOR_CRYPTO_SYMBOLS,
    entity_types: "cryptocurrency",
    must_have_entities: "true",
    filter_entities: "true",
    limit: "20",
  };

  const todayResult = await fetchAndCleanMarketaux(apiKey, {
    ...baseParams,
    published_after: `${todayIso}T00:00:00`,
  });

  const todayOnly = todayResult.articles.filter(
    (a) => a.publishedAt && isSameUtcDay(a.publishedAt, now)
  );
  if (todayOnly.length > 0) return { articles: todayOnly, ok: todayResult.ok };

  // Widen to a bounded fallback window rather than showing nothing —
  // never the unbounded "whatever's most recent" query that let stale/
  // unrelated articles leak in on other feeds before this same fix.
  const fallbackResult = await fetchAndCleanMarketaux(apiKey, {
    ...baseParams,
    published_after: toMarketauxDate(new Date(now.getTime() - FALLBACK_WINDOW_MS)),
  });
  return { articles: fallbackResult.articles, ok: todayResult.ok || fallbackResult.ok };
}

export async function GET() {
  const marketauxKey = process.env.MARKETAUX_API_KEY;

  if (!marketauxKey) {
    return NextResponse.json(
      { error: "Server is missing MARKETAUX_API_KEY configuration" },
      { status: 500 }
    );
  }

  const { data: marketauxResult, stale, staleFetchedAt } = await withCacheAndFallback(
    "crypto-news:marketaux",
    MARKETAUX_CACHE_TTL_MS,
    loadMarketaux,
    (result) => result.ok,
    true
  );

  if (!marketauxResult.ok && !stale) {
    return NextResponse.json({ articles: [], degraded: true });
  }

  const realArticles: NewsArticle[] = dedupeSimilarTitles(
    dedupeAndSortArticles(filterRecentArticles(marketauxResult.articles))
  )
    .filter((a) => !isFromWireService(a))
    .filter(isEnglishScript)
    .map((article) => ({ ...article, category: "Crypto" }));

  const generated = await fetchGeneratedArticles("crypto");
  const pool = dedupeAndSortArticles([...realArticles, ...generated]);
  const articles = withGuaranteedGeneratedArticle(pool, RESULT_COUNT);

  return NextResponse.json({ articles, stale, staleFetchedAt });
}
