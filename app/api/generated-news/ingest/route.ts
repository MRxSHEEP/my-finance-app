import { NextRequest, NextResponse } from "next/server";
import { checkCronAuth } from "@/lib/trackers/cronAuth";
import { ensureArticleForTicker, type EnsureArticleResult } from "@/lib/generatedNews/publish";
import { SIGNALS_WATCHLIST } from "@/lib/signals/watchlist";
import { CRYPTO_DISPLAY_NAMES } from "@/lib/generatedNews/cryptoSymbolMap";
import { COMMODITY_NAMES } from "@/lib/commodityNames";
import {
  GENERATED_NEWS_COMMODITY_SYMBOLS,
  GENERATED_NEWS_CRYPTO_IDS,
  GENERATED_NEWS_STOCK_TICKERS,
} from "@/lib/generatedNews/watchlist";
import type { GeneratedNewsAssetType } from "@/lib/generatedNews/types";

export const dynamic = "force-dynamic";
// Same reasoning as app/api/signals/ingest/route.ts's own maxDuration —
// this loops sequentially over a dozen tickers, each doing several
// external calls plus one Anthropic call.
export const maxDuration = 300;

interface WatchlistItem {
  assetType: GeneratedNewsAssetType;
  ticker: string;
  displayName: string;
}

function buildWatchlist(): WatchlistItem[] {
  const stocks: WatchlistItem[] = GENERATED_NEWS_STOCK_TICKERS.map((ticker) => {
    const entry = SIGNALS_WATCHLIST.find((w) => w.ticker === ticker);
    return { assetType: "stock", ticker, displayName: entry?.companyName ?? ticker };
  });
  const crypto: WatchlistItem[] = GENERATED_NEWS_CRYPTO_IDS.map((ticker) => ({
    assetType: "crypto",
    ticker,
    displayName: CRYPTO_DISPLAY_NAMES[ticker] ?? ticker,
  }));
  const commodities: WatchlistItem[] = GENERATED_NEWS_COMMODITY_SYMBOLS.map((ticker) => ({
    assetType: "commodity",
    ticker,
    displayName: COMMODITY_NAMES[ticker] ?? ticker,
  }));
  return [...stocks, ...crypto, ...commodities];
}

interface ItemResult {
  assetType: GeneratedNewsAssetType;
  ticker: string;
  status: EnsureArticleResult;
}

// Sequential, not parallel — same reasoning as
// app/api/signals/ingest/route.ts's own ticker loop: each item's gather
// step already fans out several external calls (TwelveData/CoinGecko/
// Polygon, Marketaux, one Anthropic call), and running all of them
// concurrently would burst every provider at once instead of pacing
// through them one item at a time.
export async function GET(request: NextRequest) {
  const authError = checkCronAuth(request);
  if (authError) return authError;

  const origin = request.nextUrl.origin;
  const results: ItemResult[] = [];

  for (const item of buildWatchlist()) {
    const status = await ensureArticleForTicker(item.assetType, item.ticker, item.displayName, origin);
    results.push({ assetType: item.assetType, ticker: item.ticker, status });
  }

  return NextResponse.json({
    itemsProcessed: results.length,
    published: results.filter((r) => r.status === "published").length,
    results,
  });
}
