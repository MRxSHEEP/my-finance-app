import { NextResponse } from "next/server";
import {
  fetchAndCleanMarketaux,
  fetchAndCleanNewsApi,
  mergeArticleSources,
  type NewsArticle,
} from "@/lib/newsApi";
import { withCache } from "@/lib/newsCache";

// fetchAndCleanNewsApi/fetchAndCleanMarketaux both build their query params
// as `{ ...defaultQuery, ...params }`, so passing `q`/`search` here
// overrides the general-market default query from lib/newsApi.ts (used by
// /api/news) without needing to touch that shared module.
//
// Quoted market-context phrases rather than bare commodity names — bare
// "gold"/"silver"/"corn" match jewelry, car trim/paint names, and
// unrelated consumer content (confirmed live: a Land Rover listing showed
// up under the old bare-word query, almost certainly via "gold"/"silver"
// as paint colors). Phrasing every term as a market context cuts that off
// at the query itself, before the denylist filter below even runs.
const COMMODITIES_NEWS_QUERY =
  '"gold price" OR "gold market" OR "crude oil price" OR "oil prices" OR OPEC OR "natural gas prices" OR "silver market" OR "commodity prices" OR "copper prices"';
const PAGE_SIZE = "9";

// Marketaux's `industries` param does filter (confirmed live: pairing the
// query above with industries=Financial dropped result count to zero),
// but with no documented taxonomy to test against, an untested value is
// as likely to silently over-filter as it is to help — worse than doing
// nothing. Skipped in favor of the query + denylist below, both of which
// were verified against real results.
//
// NewsAPI's /v2/everything endpoint (what's used here and by /api/news)
// has no category param at all — that only exists on /v2/top-headlines,
// which doesn't support this kind of free-text query.

// Safety net for whatever still slips past the tightened query above: if
// an article's title/description contains a term that tends to
// false-positive on commodity keywords, only keep it when a clear market
// term is *also* present. This is deliberately narrow (real automotive/
// jewelry terms observed or specified, not bare words like "watch" that
// would false-positive on ordinary market phrasing like "investors watch
// gold prices").
const DENYLIST_TERMS = [
  "wedding ring",
  "engagement ring",
  "jewelry",
  "jewellery",
  "necklace",
  "bracelet",
  "earrings",
  "vehicle",
  "sedan",
  "suv",
  "coupe",
  "convertible",
  "horsepower",
  "mileage",
  "supercharged",
  "test drive",
  "dealership",
  "land rover",
  "range rover",
  "for sale by owner",
];

const MARKET_CONTEXT_TERMS = [
  "price",
  "prices",
  "market",
  "markets",
  "futures",
  "barrel",
  "ounce",
  "opec",
  "supply",
  "demand",
  "production",
  "inventory",
  "trading",
  "export",
  "import",
  "reserve",
  "reserves",
  "commodity",
  "commodities",
];

function isLikelyRelevant(article: NewsArticle): boolean {
  const text = `${article.title} ${article.description ?? ""}`.toLowerCase();
  const hasDenylistedTerm = DENYLIST_TERMS.some((term) => text.includes(term));
  if (!hasDenylistedTerm) return true;
  return MARKET_CONTEXT_TERMS.some((term) => text.includes(term));
}

// Same TTL reasoning as app/api/news/route.ts: NewsAPI's is mostly a
// de-dup safety net, Marketaux's protects its 100-requests/day cap.
const NEWSAPI_CACHE_TTL_MS = 60_000;
const MARKETAUX_CACHE_TTL_MS = 20 * 60_000;

export async function GET() {
  const newsApiKey = process.env.NEWSAPI_KEY;
  const marketauxKey = process.env.MARKETAUX_API_KEY;

  const [newsApiResult, marketauxResult] = await Promise.all([
    withCache("commodities:newsapi", NEWSAPI_CACHE_TTL_MS, () =>
      fetchAndCleanNewsApi(newsApiKey, {
        q: COMMODITIES_NEWS_QUERY,
        sortBy: "publishedAt",
        language: "en",
        pageSize: PAGE_SIZE,
        page: "1",
      })
    ),
    withCache("commodities:marketaux", MARKETAUX_CACHE_TTL_MS, () =>
      fetchAndCleanMarketaux(marketauxKey, {
        search: COMMODITIES_NEWS_QUERY,
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

  const merged = mergeArticleSources(newsApiResult.articles, marketauxResult.articles);
  const articles = merged.filter(isLikelyRelevant);

  return NextResponse.json({ articles });
}
