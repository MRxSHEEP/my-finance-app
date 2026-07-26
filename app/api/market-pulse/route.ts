import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { withCache } from "@/lib/newsCache";
import {
  dedupeAndSortArticles,
  fetchAndCleanMarketaux,
  filterRecentArticles,
  MAJOR_STOCK_SYMBOLS,
  toMarketauxDate,
} from "@/lib/newsApi";

export const dynamic = "force-dynamic";

// Refreshed at most every 7 minutes (within the requested 5-10 minute
// window) — the AI call is the expensive/slow part of this route, and
// "why is the market moving" doesn't meaningfully change minute to
// minute, so there's no reason to regenerate it on every home page load.
const CACHE_TTL_MS = 7 * 60_000;
const HEADLINE_WINDOW_MS = 12 * 60 * 60_000;
const HEADLINE_COUNT = 5;

// SPY/QQQ/DIA (S&P 500/Nasdaq/Dow ETF proxies — same proxy reasoning as
// app/api/ticker/route.ts, whose DIA/QQQ this reuses) and the Mag 7,
// reused from the same /api/stock/mini-quotes route the /stocks page's
// FeaturedTickersSection already calls.
const INDEX_SYMBOLS = ["SPY", "QQQ", "DIA"];
const MAG7_SYMBOLS = ["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA"];

interface MiniQuote {
  symbol: string;
  price: number | null;
  change: number | null;
  percentChange: number | null;
}

interface CommodityQuote {
  symbol: string;
  name: string;
  price: number | null;
  change: number | null;
  percentChange: number | null;
}

interface MarketPulseResponse {
  explanation: string | null;
  generatedAt: string | null;
  available: boolean;
}

// Reuses /api/stock/mini-quotes (already used by the /stocks page's ETF
// and Mag 7 sections) via an internal fetch against the current
// request's own origin, rather than duplicating Finnhub-fetch logic a
// third time (app/api/ticker/route.ts and that route already each have
// their own copy). `sparkline=false` skips that route's TwelveData
// history fetch — a ~7.6s/symbol throttled call this route never
// renders a chart for, so fetching it would only make this route slow
// for no benefit.
async function fetchMiniQuotes(symbols: string[], origin: string): Promise<MiniQuote[]> {
  try {
    const url = new URL(`/api/stock/mini-quotes?symbols=${symbols.join(",")}&sparkline=false`, origin);
    const response = await fetch(url);
    if (!response.ok) return [];
    const body = await response.json().catch(() => null);
    return Array.isArray(body?.quotes) ? body.quotes : [];
  } catch {
    return [];
  }
}

// Reuses /api/ticker's `commodities` array (already fetches oil via USO)
// the same way — an internal fetch rather than a duplicated Finnhub call.
async function fetchOilQuote(origin: string): Promise<CommodityQuote | null> {
  try {
    const url = new URL("/api/ticker", origin);
    const response = await fetch(url);
    if (!response.ok) return null;
    const body = await response.json().catch(() => null);
    const commodities: CommodityQuote[] = Array.isArray(body?.commodities) ? body.commodities : [];
    return commodities.find((c) => c.symbol === "USO") ?? null;
  } catch {
    return null;
  }
}

// Reuses lib/newsApi.ts's fetch/dedupe pipeline directly (no HTTP
// round-trip needed here, unlike the quote fetches above — these are
// already plain importable functions, not tied to a specific route).
// Marketaux's own entity match (symbols + must_have_entities) is the
// relevance mechanism now, same as every other feed.
async function fetchHeadlines(): Promise<string[]> {
  const marketauxKey = process.env.MARKETAUX_API_KEY;
  if (!marketauxKey) return [];

  const fromIso = toMarketauxDate(new Date(Date.now() - HEADLINE_WINDOW_MS));

  const marketauxResult = await fetchAndCleanMarketaux(marketauxKey, {
    symbols: MAJOR_STOCK_SYMBOLS,
    must_have_entities: "true",
    filter_entities: "true",
    limit: "10",
    published_after: fromIso,
  });

  const recent = filterRecentArticles(dedupeAndSortArticles(marketauxResult.articles), HEADLINE_WINDOW_MS);
  return recent.slice(0, HEADLINE_COUNT).map((article) => article.title);
}

interface MarketSnapshot {
  indexQuotes: MiniQuote[];
  topMovers: MiniQuote[];
  oil: CommodityQuote | null;
  headlines: string[];
}

async function gatherMarketSnapshot(origin: string): Promise<MarketSnapshot> {
  const [indexQuotes, mag7Quotes, oil, headlines] = await Promise.all([
    fetchMiniQuotes(INDEX_SYMBOLS, origin),
    fetchMiniQuotes(MAG7_SYMBOLS, origin),
    fetchOilQuote(origin),
    fetchHeadlines(),
  ]);

  // Biggest movers (up or down) first — those are the names most likely
  // to actually explain the day's move, not just whichever came first.
  const topMovers = [...mag7Quotes]
    .filter((quote) => quote.percentChange != null)
    .sort((a, b) => Math.abs(b.percentChange!) - Math.abs(a.percentChange!))
    .slice(0, 3);

  return { indexQuotes, topMovers, oil, headlines };
}

function formatPercent(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

// Renders the gathered snapshot into the exact data points the model is
// allowed to reason about — nothing here is a number the model invents,
// and the instructions below explicitly forbid adding any that aren't.
function buildPrompt(snapshot: MarketSnapshot): string {
  const indexLines = snapshot.indexQuotes
    .filter((quote) => quote.percentChange != null)
    .map((quote) => `${quote.symbol} ${formatPercent(quote.percentChange!)}`)
    .join(", ");

  const moverLines = snapshot.topMovers
    .map((quote) => `${quote.symbol} ${formatPercent(quote.percentChange!)}`)
    .join(", ");

  const oilLine =
    snapshot.oil?.percentChange != null
      ? `Crude oil (WTI): ${formatPercent(snapshot.oil.percentChange)}`
      : "Crude oil: not available";

  const headlineLines =
    snapshot.headlines.length > 0
      ? snapshot.headlines.map((title) => `- ${title}`).join("\n")
      : "(none available)";

  return `Here is today's market data:

Major indexes (ETF proxies): ${indexLines || "not available"}
Biggest-moving Magnificent 7 stocks: ${moverLines || "not available"}
${oilLine}
Recent finance headlines:
${headlineLines}

Write a brief 2-3 sentence explanation of why the market is moving today, in plain language for a retail investor. Cite the specific data points given above. Do not invent statistics, percentages, or numbers that were not explicitly provided above. If a data point above says "not available," do not speculate about it or make up a value for it — just work with what was actually given.`;
}

async function generateExplanation(snapshot: MarketSnapshot): Promise<string | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;

  const hasAnyData =
    snapshot.indexQuotes.some((q) => q.percentChange != null) ||
    snapshot.topMovers.length > 0 ||
    snapshot.oil?.percentChange != null ||
    snapshot.headlines.length > 0;
  // Nothing to reason about — skip the call rather than asking the model
  // to write around an entirely empty data set, which is exactly the
  // situation most likely to produce a fabricated-sounding answer.
  if (!hasAnyData) return null;

  try {
    const anthropic = new Anthropic();
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 200,
      messages: [{ role: "user", content: buildPrompt(snapshot) }],
    });

    const textBlock = message.content.find((block) => block.type === "text");
    const generated = textBlock?.type === "text" ? textBlock.text.trim() : "";
    return generated || null;
  } catch (err) {
    console.error(
      `[market-pulse] Anthropic request failed: ${err instanceof Error ? err.message : String(err)}`
    );
    return null;
  }
}

export async function GET(request: NextRequest) {
  const data = await withCache("market-pulse", CACHE_TTL_MS, async (): Promise<MarketPulseResponse> => {
    const snapshot = await gatherMarketSnapshot(request.nextUrl.origin);
    const explanation = await generateExplanation(snapshot);

    return {
      explanation,
      generatedAt: explanation ? new Date().toISOString() : null,
      available: explanation !== null,
    };
  });

  return NextResponse.json(data);
}
