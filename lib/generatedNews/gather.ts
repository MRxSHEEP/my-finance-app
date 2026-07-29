import type { RawBar } from "@/lib/stockHistoryCache";
import {
  COMMODITY_ANCHOR_TERMS,
  COMMODITY_DENYLIST_TERMS,
  dedupeAndSortArticles,
  fetchAndCleanMarketaux,
  filterRecentArticles,
  isEnglishScript,
  isFromWireService,
  toMarketauxDate,
  type NewsArticle,
} from "@/lib/newsApi";
import { gatherTickerData } from "@/lib/signals/gather";
import { computeTechnicals } from "@/lib/signals/technicals";
import type { NewsHeadlineSnapshot } from "@/lib/signals/types";
import { CRYPTO_ID_TO_MARKETAUX_SYMBOL } from "@/lib/generatedNews/cryptoSymbolMap";
import type { GeneratedNewsDataSnapshot } from "@/lib/generatedNews/types";

const NEWS_WINDOW_MS = 7 * 24 * 60 * 60_000;
const NEWS_HEADLINE_COUNT = 5;

// Same never-throws, resolve-null-on-any-failure convention as
// lib/signals/gather.ts's own private fetchInternalJson — composing this
// app's own internal routes rather than duplicating their upstream-provider
// logic for crypto/commodity price history.
async function fetchInternalJson<T>(path: string, origin: string): Promise<T | null> {
  try {
    const response = await fetch(new URL(path, origin));
    if (!response.ok) return null;
    return (await response.json().catch(() => null)) as T | null;
  } catch {
    return null;
  }
}

function toHeadlineSnapshots(articles: NewsArticle[]): NewsHeadlineSnapshot[] {
  return articles.slice(0, NEWS_HEADLINE_COUNT).map((a) => ({
    title: a.title,
    source: a.source,
    publishedAt: a.publishedAt,
  }));
}

// -----------------------------------------------------------------------
// Stock — verbatim reuse of /signals' own gather step, the exact same
// technicals/analyst/earnings/news/insider/congress data /signals shows.
// -----------------------------------------------------------------------

export async function gatherStockData(ticker: string, companyName: string, origin: string): Promise<GeneratedNewsDataSnapshot> {
  const data = await gatherTickerData(ticker, origin);
  return {
    assetType: "stock",
    ticker,
    displayName: companyName,
    technical: data.technical,
    analystRating: data.analystRating,
    earnings: data.earnings,
    insiderActivity: data.insiderActivity,
    congressActivity: data.congressActivity,
    news: data.news,
  };
}

// -----------------------------------------------------------------------
// Crypto — technicals from CoinGecko daily price/volume history (via this
// app's own /api/crypto/detail route, same composition style as
// gatherTickerData's internal-route calls); no analyst rating, earnings,
// or insider/congress data, since none of that exists for a coin. News is
// scoped to the coin's own Marketaux symbol when one is mapped
// (cryptoSymbolMap.ts), honestly empty otherwise.
// -----------------------------------------------------------------------

interface CryptoDetailResponse {
  history: Array<{ date: string; close: number }>;
  volumeHistory: Array<{ date: string; value: number }>;
}

async function gatherCryptoNews(marketauxSymbol: string): Promise<NewsHeadlineSnapshot[]> {
  const marketauxKey = process.env.MARKETAUX_API_KEY;
  const fromIso = toMarketauxDate(new Date(Date.now() - NEWS_WINDOW_MS));

  const result = await fetchAndCleanMarketaux(marketauxKey, {
    symbols: marketauxSymbol,
    entity_types: "cryptocurrency",
    must_have_entities: "true",
    filter_entities: "true",
    limit: "10",
    published_after: fromIso,
  });

  const recent = filterRecentArticles(dedupeAndSortArticles(result.articles), NEWS_WINDOW_MS);
  return toHeadlineSnapshots(recent);
}

export async function gatherCryptoData(coinGeckoId: string, displayName: string, origin: string): Promise<GeneratedNewsDataSnapshot> {
  const [detail, marketauxSymbol] = [
    await fetchInternalJson<CryptoDetailResponse>(
      `/api/crypto/detail?id=${encodeURIComponent(coinGeckoId)}&range=1Y&chartType=line`,
      origin
    ),
    CRYPTO_ID_TO_MARKETAUX_SYMBOL[coinGeckoId],
  ];

  // /api/crypto/detail's line-mode history has open=high=low=close=price
  // (CoinGecko's market_chart endpoint only ever gives one price point per
  // timestamp, not real OHLC) — still enough for SMA/RSI. volumeHistory
  // comes from that same underlying call, aligned index-for-index with
  // history (both are zipped from the same market_chart response), so it's
  // safe to zip by position for computeVolumeTrend's benefit.
  const bars: RawBar[] = (detail?.history ?? []).map((point, i) => ({
    date: point.date,
    open: point.close,
    high: point.close,
    low: point.close,
    close: point.close,
    volume: detail?.volumeHistory?.[i]?.value,
  }));

  const news = marketauxSymbol ? await gatherCryptoNews(marketauxSymbol) : [];

  return {
    assetType: "crypto",
    ticker: coinGeckoId,
    displayName,
    technical: computeTechnicals(bars),
    analystRating: null,
    earnings: null,
    insiderActivity: [],
    congressActivity: [],
    news,
  };
}

// -----------------------------------------------------------------------
// Commodities — technicals from this app's own /api/commodities/detail
// route (already handles the ETF-proxy vs. gold/silver Polygon-forex split
// internally); no analyst rating, earnings, or insider/congress data, since
// none of that exists for a commodity. News reuses the exact
// anchor-term/denylist relevance filter app/api/commodities/news/route.ts
// already established for this same "generic single-word search term"
// problem, scoped to this one commodity's own term instead of the broad
// "commodities" query that route uses.
// -----------------------------------------------------------------------

const COMMODITY_NEWS_SEARCH_TERMS: Record<string, string> = {
  "C:XAUUSD": "gold",
  "C:XAGUSD": "silver",
  USO: "oil",
  BNO: "brent",
  UNG: "gas",
  CPER: "copper",
  CORN: "corn",
  WEAT: "wheat",
  SOYB: "soybeans",
};

interface CommodityDetailResponse {
  history: RawBar[];
}

function isLikelyRelevantCommodityArticle(article: NewsArticle): boolean {
  if (isFromWireService(article)) return false;
  const title = article.title.toLowerCase();
  if (!COMMODITY_ANCHOR_TERMS.some((term) => title.includes(term))) return false;
  const text = `${article.title} ${article.description ?? ""}`.toLowerCase();
  return !COMMODITY_DENYLIST_TERMS.some((term) => text.includes(term));
}

async function gatherCommodityNews(symbol: string): Promise<NewsHeadlineSnapshot[]> {
  const searchTerm = COMMODITY_NEWS_SEARCH_TERMS[symbol];
  if (!searchTerm) return [];

  const marketauxKey = process.env.MARKETAUX_API_KEY;
  const fromIso = toMarketauxDate(new Date(Date.now() - NEWS_WINDOW_MS));

  const result = await fetchAndCleanMarketaux(marketauxKey, {
    search: searchTerm,
    limit: "10",
    published_after: fromIso,
  });

  const recent = filterRecentArticles(dedupeAndSortArticles(result.articles), NEWS_WINDOW_MS)
    .filter(isLikelyRelevantCommodityArticle)
    .filter(isEnglishScript);
  return toHeadlineSnapshots(recent);
}

export async function gatherCommodityData(symbol: string, displayName: string, origin: string): Promise<GeneratedNewsDataSnapshot> {
  const [detail, news] = await Promise.all([
    fetchInternalJson<CommodityDetailResponse>(`/api/commodities/detail?symbol=${encodeURIComponent(symbol)}&range=1Y`, origin),
    gatherCommodityNews(symbol),
  ]);

  return {
    assetType: "commodity",
    ticker: symbol,
    displayName,
    technical: computeTechnicals(detail?.history ?? []),
    analystRating: null,
    earnings: null,
    insiderActivity: [],
    congressActivity: [],
    news,
  };
}
