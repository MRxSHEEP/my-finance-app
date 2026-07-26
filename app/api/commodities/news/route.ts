import { NextResponse } from "next/server";
import {
  COMMODITY_ANCHOR_TERMS,
  COMMODITY_DENYLIST_TERMS,
  dedupeAndSortArticles,
  dedupeSimilarTitles,
  FALLBACK_WINDOW_MS,
  fetchAndCleanMarketaux,
  filterRecentArticles,
  isEnglishScript,
  isFromWireService,
  MARKETAUX_CACHE_TTL_MS,
  toMarketauxDate,
  type NewsArticle,
  type SourceResult,
} from "@/lib/newsApi";
import { withCacheAndFallback } from "@/lib/newsCache";

// Live-verified: Marketaux's `search` parameter does NOT support n-ary
// boolean OR the way the previous version of this route assumed (a
// holdover mental model from the NewsAPI-era query syntax, before this
// app consolidated onto Marketaux — see lib/newsApi.ts's own header
// comment on that migration). Confirmed directly against the live API:
// `search=gold` alone found 830 matches in a 7-day window, `search=oil`
// found 1681, but `search=gold OR oil` found only 125 — a genuine union
// would be >= 1681, not roughly a tenth of it. Adding more " OR term"
// clauses only shrinks the result count further (an 8-term chain of
// exactly this shape found 0), consistent with everything after the
// first clause acting like an additional required term rather than an
// alternative. That's why the previous exhaustively-quoted, 9-clause OR
// query always returned zero articles within the 7-day recency window
// this route enforces — not a genuine lack of Marketaux commodities
// coverage. A single, broad, unquoted term avoids the whole problem;
// "commodities" itself is inherently financial/economic vocabulary
// (unlike bare "gold"/"oil"/"silver", which also catch jewelry/car
// content), so it needs no quoting and stays clean on its own — the
// COMMODITY_ANCHOR_TERMS + COMMODITY_DENYLIST_TERMS filter below (shared
// with the general News feed's classifier, see lib/newsApi.ts) is kept as
// a second layer regardless.
const COMMODITIES_NEWS_QUERY = "commodities";

function isLikelyRelevant(article: NewsArticle): boolean {
  if (isFromWireService(article)) return false;

  const title = article.title.toLowerCase();
  if (!COMMODITY_ANCHOR_TERMS.some((term) => title.includes(term))) return false;

  const text = `${article.title} ${article.description ?? ""}`.toLowerCase();
  return !COMMODITY_DENYLIST_TERMS.some((term) => text.includes(term));
}

function isSameUtcDay(dateStr: string, reference: Date): boolean {
  const d = new Date(dateStr);
  return (
    d.getUTCFullYear() === reference.getUTCFullYear() &&
    d.getUTCMonth() === reference.getUTCMonth() &&
    d.getUTCDate() === reference.getUTCDate()
  );
}

// Same today-first, 72h-fallback tiering as the stock/crypto news routes
// (app/api/stock/news/route.ts, app/api/crypto/news/route.ts) — kept to
// exactly 2 Marketaux calls per cache refresh (same as those routes), not
// one call per commodity/term: this account's usage quota is tight
// (confirmed live via the `x-usagelimit-limit`/`x-usagelimit-remaining`
// response headers — a small fixed budget, not a generous per-minute
// rate limit), so this route makes the same number of upstream requests
// as every other Marketaux consumer rather than scaling with the number
// of commodities tracked.
async function loadMarketaux(): Promise<SourceResult> {
  const apiKey = process.env.MARKETAUX_API_KEY;
  const now = new Date();
  const todayIso = now.toISOString().slice(0, 10);
  const baseParams = { search: COMMODITIES_NEWS_QUERY, limit: "20" };

  const todayResult = await fetchAndCleanMarketaux(apiKey, {
    ...baseParams,
    published_after: `${todayIso}T00:00:00`,
  });

  const todayOnly = todayResult.articles.filter(
    (a) => a.publishedAt && isSameUtcDay(a.publishedAt, now)
  );
  if (todayOnly.length > 0) return { articles: todayOnly, ok: todayResult.ok };

  const fallbackResult = await fetchAndCleanMarketaux(apiKey, {
    ...baseParams,
    published_after: toMarketauxDate(new Date(now.getTime() - FALLBACK_WINDOW_MS)),
  });
  return { articles: fallbackResult.articles, ok: todayResult.ok || fallbackResult.ok };
}

// This account's Marketaux plan only ever returns 3 articles per request
// regardless of the `limit` param (confirmed live via the response's own
// `meta.limit`), and the usage quota is too tight (~100 requests total,
// shared across every Marketaux consumer in the app) to fetch additional
// pages just to pad this one list out. Instead of discarding the previous
// cache cycle's articles the moment a new (still-just-3-article) fetch
// resolves, this keeps a rolling, deduped, capped window that accumulates
// across cache refreshes — the same 2-calls-per-25-minutes cadence as
// before, just remembered for longer, so the list genuinely grows over a
// few refresh cycles instead of only ever showing whatever the single
// latest fetch happened to return. Still bounded by MAX_ARTICLE_AGE_MS
// (via filterRecentArticles below), so nothing lingers past a week.
const ROLLING_ARTICLE_CAP = 20;
let rollingArticles: NewsArticle[] = [];

function mergeIntoRollingArticles(fresh: NewsArticle[]): NewsArticle[] {
  const merged = dedupeSimilarTitles(
    dedupeAndSortArticles(filterRecentArticles([...fresh, ...rollingArticles]))
  );
  rollingArticles = merged.slice(0, ROLLING_ARTICLE_CAP);
  return rollingArticles;
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
    "commodities:marketaux",
    MARKETAUX_CACHE_TTL_MS,
    loadMarketaux,
    (result) => result.ok,
    true
  );

  if (!marketauxResult.ok && !stale && rollingArticles.length === 0) {
    return NextResponse.json({ articles: [], degraded: true });
  }

  const fresh = marketauxResult.articles.filter(isLikelyRelevant).filter(isEnglishScript);

  const articles: NewsArticle[] = mergeIntoRollingArticles(fresh).map((article) => ({
    ...article,
    category: "Commodities",
  }));

  return NextResponse.json({ articles, stale, staleFetchedAt });
}
