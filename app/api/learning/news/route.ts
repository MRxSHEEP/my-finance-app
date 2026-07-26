import { NextRequest, NextResponse } from "next/server";
import { fetchAndCleanMarketaux, isFromWireService, type NewsArticle } from "@/lib/newsApi";
import { withCacheAndFallback } from "@/lib/newsCache";

export const dynamic = "force-dynamic";

// Refetched at most once a day — course content should read as stable
// reference material, not shift headlines out from under someone mid-read.
const CACHE_TTL_MS = 24 * 60 * 60_000;

// Curated per-topic search terms, kept server-side so the client only ever
// requests by topicId — not an arbitrary free-text query.
// Quoted phrases matter here — an unquoted "insider buying OR insider
// selling" gets parsed as a loose keyword match by both providers and can
// surface unrelated stories that merely contain "insider" or "selling".
const TOPIC_QUERIES: Record<string, string> = {
  dcf: '"DCF valuation" OR "discounted cash flow"',
  ebitda: '"EBITDA"',
  "ev-ebitda": '"EV/EBITDA" OR "enterprise value"',
  "analyst-ratings": '"analyst upgrade" OR "price target"',
  "insider-trading": '"insider buying" OR "insider selling"',
  "dividend-yield": '"dividend increase" OR "dividend cut"',
  "pe-ratio": '"P/E ratio" OR "price-to-earnings"',
  eps: '"earnings per share" OR "EPS beat" OR "EPS miss"',
  "peg-ratio": '"PEG ratio"',
  "market-cap": '"market capitalization" OR "market cap"',
  beta: '"stock volatility" OR "high-beta"',
  dca: '"dollar-cost averaging"',
};

export async function GET(request: NextRequest) {
  const topicId = request.nextUrl.searchParams.get("topicId") ?? "";
  const query = TOPIC_QUERIES[topicId];

  if (!query) {
    return NextResponse.json({ error: "Unknown or unsupported topicId" }, { status: 400 });
  }

  const marketauxKey = process.env.MARKETAUX_API_KEY;

  // Sorted by recency (Marketaux's `sort` doesn't offer a relevancy-rank
  // option the way NewsAPI's `sortBy=relevancy` did) — the quoted phrase
  // itself carries the precision here, same as every other feed now
  // consolidated onto this one provider.
  // withCacheAndFallback keeps showing yesterday's matched article (rather
  // than nothing at all) if today's refresh fails — this feed already
  // degrades to `article: null` on any failure, so surfacing a stale-but-
  // real article instead is a strict improvement, no new UI needed.
  const { data: marketauxResult } = await withCacheAndFallback(
    `learning-news:${topicId}`,
    CACHE_TTL_MS,
    () => fetchAndCleanMarketaux(marketauxKey, { search: query, limit: "5" }),
    (result) => result.ok,
    true
  );

  if (!marketauxResult.ok) {
    return NextResponse.json({ article: null });
  }

  // A wire-service press release can still match a quoted finance phrase
  // (e.g. a corporate boilerplate paragraph mentioning "dividend cut" in
  // an unrelated announcement) — excluded the same way as every other
  // feed rather than trusting the query's specificity alone.
  const article: NewsArticle | null = marketauxResult.articles.find((a) => !isFromWireService(a)) ?? null;

  return NextResponse.json({ article });
}
