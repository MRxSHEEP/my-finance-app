import { NextResponse } from "next/server";
import {
  classifyAndStripEntityTypes,
  dedupeAndSortArticles,
  fetchAndCleanMarketaux,
  filterRecentArticles,
  isFromWireService,
  MAJOR_CRYPTO_SYMBOLS,
  MAJOR_STOCK_SYMBOLS,
  MARKETAUX_CACHE_TTL_MS,
  toMarketauxDate,
  type NewsArticle,
} from "@/lib/newsApi";
import { withCacheAndFallback } from "@/lib/newsCache";

// Same broadened symbol set as the grid route (app/api/news/route.ts) —
// one call covering both stocks and crypto, so the ticker can surface a
// Crypto headline too instead of being stock-only, at no added quota cost.
const GENERAL_FEED_SYMBOLS = `${MAJOR_STOCK_SYMBOLS},${MAJOR_CRYPTO_SYMBOLS}`;

// The grid and ticker query the same Marketaux entity set with the same
// sort, so without a distinct page the ticker's "most recent" results
// would just be a subset of the grid's own results — the client-side dedup
// against the grid (see app/news/page.tsx) would then strip all of them,
// leaving an empty ticker. Requesting a later page keeps the two
// structurally distinct instead of relying on client dedup alone to fix up
// a fully-overlapping result set. The grid's own initial load now spans
// pages 1-5 (15 articles up front, ≤3/page — see app/news/page.tsx), so
// this has to sit past that whole range, not just past page 1.
const TICKER_PAGE = "6";

// `limit: "20"` below is requested but not actually honored — live-
// confirmed that this account's Marketaux plan caps every request at
// exactly 3 articles regardless of the requested limit (see the identical
// note in app/api/news/route.ts). So the ticker's rotation pool is at most
// 3 items per poll, before the grid-URL dedup above potentially shrinks it
// further — not a bug in the rotation logic itself (NewsTicker.tsx does
// rotate through whatever it's given, including exactly 3 items).
const TICKER_LIMIT = "20";

export async function GET() {
  const marketauxKey = process.env.MARKETAUX_API_KEY;

  const fromIso = toMarketauxDate(new Date(Date.now() - 7 * 24 * 60 * 60_000));

  const { data: marketauxResult, stale, staleFetchedAt } = await withCacheAndFallback(
    "ticker:marketaux",
    MARKETAUX_CACHE_TTL_MS,
    () =>
      fetchAndCleanMarketaux(marketauxKey, {
        symbols: GENERAL_FEED_SYMBOLS,
        must_have_entities: "true",
        filter_entities: "true",
        limit: TICKER_LIMIT,
        page: TICKER_PAGE,
        published_after: fromIso,
      }),
    (result) => result.ok,
    true
  );

  if (!marketauxResult.ok && !stale) {
    return NextResponse.json({ articles: [], degraded: true });
  }

  const articles: NewsArticle[] = dedupeAndSortArticles(filterRecentArticles(marketauxResult.articles))
    .filter((a) => !isFromWireService(a))
    .map(classifyAndStripEntityTypes);

  return NextResponse.json({ articles, stale, staleFetchedAt });
}
