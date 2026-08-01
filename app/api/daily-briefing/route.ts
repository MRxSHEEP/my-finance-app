import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { withCache } from "@/lib/newsCache";
import { fetchEarningsCalendar } from "@/lib/earningsCalendar";
import {
  dedupeAndSortArticles,
  fetchAndCleanMarketaux,
  filterRecentArticles,
  MAJOR_STOCK_SYMBOLS,
  toMarketauxDate,
} from "@/lib/newsApi";

export const dynamic = "force-dynamic";

// The cache key below includes today's UTC date, so this genuinely only
// regenerates once per calendar day no matter how many times it's hit —
// the TTL just needs to comfortably outlive one day between key
// rotations, it isn't what actually drives the "once a day" behavior.
// UTC (not the user's local day, or US market time) to stay consistent
// with the isSameUtcDay convention already used throughout the news
// routes (see app/api/news/ticker/route.ts).
const CACHE_TTL_MS = 25 * 60 * 60_000;

// "Overnight" news window — wide enough to span from last night's close
// through this morning, without reaching back into yesterday's main
// trading-day news cycle.
const NEWS_WINDOW_MS = 16 * 60 * 60_000;
const HEADLINE_COUNT = 6;

const INDEX_SYMBOLS = ["SPY", "QQQ", "DIA"];
const MAG7_SYMBOLS = ["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA"];

interface MiniQuote {
  symbol: string;
  price: number | null;
  change: number | null;
  percentChange: number | null;
}

// Same reuse of /api/stock/mini-quotes as app/api/market-pulse/route.ts,
// including the sparkline=false opt-out added for that route — this one
// never renders a chart either.
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

interface EarningsEntry {
  symbol: string;
  name: string;
  hour: string | null;
}

// Sources from the same lib/earningsCalendar.ts fetcher that powers the
// dedicated /earnings page, filtered down to just today — rather than
// this route independently calling Finnhub's broad calendar itself. Since
// neither caller passes an explicit from/to, both hit the exact same
// cache key in fetchEarningsCalendar, so within a given cache window
// this route and /api/earnings-calendar share one upstream Finnhub call
// instead of each paying for their own.
async function fetchTodaysEarnings(): Promise<EarningsEntry[]> {
  const todayIso = new Date().toISOString().slice(0, 10);
  const calendar = await fetchEarningsCalendar();

  // fetchEarningsCalendar already reconciles duplicate rows sharing the
  // same symbol+date+hour, quarter/year included — see
  // reconcileEarningsDuplicates. This dedup goes one step further and
  // collapses to one mention per symbol regardless of hour, since this
  // briefing only cares about "is this company reporting today," not the
  // exact hour or how many rows Finnhub attached to it.
  const seen = new Set<string>();
  const deduped: EarningsEntry[] = [];
  for (const entry of calendar) {
    if (entry.date !== todayIso || seen.has(entry.symbol)) continue;
    seen.add(entry.symbol);
    deduped.push({ symbol: entry.symbol, name: entry.name, hour: entry.hour });
  }
  return deduped;
}

// Same fetch/dedupe pipeline as app/api/market-pulse/route.ts's own
// headline gathering, just with a wider window sized for "overnight."
// Marketaux's own entity match (symbols + must_have_entities) is the
// relevance mechanism now, same as every other feed.
async function fetchHeadlines(): Promise<string[]> {
  const marketauxKey = process.env.MARKETAUX_API_KEY;
  if (!marketauxKey) return [];

  const fromIso = toMarketauxDate(new Date(Date.now() - NEWS_WINDOW_MS));

  const marketauxResult = await fetchAndCleanMarketaux(marketauxKey, {
    symbols: MAJOR_STOCK_SYMBOLS,
    must_have_entities: "true",
    filter_entities: "true",
    limit: "15",
    published_after: fromIso,
  });

  const recent = filterRecentArticles(dedupeAndSortArticles(marketauxResult.articles), NEWS_WINDOW_MS);
  return recent.slice(0, HEADLINE_COUNT).map((article) => article.title);
}

interface BriefingSnapshot {
  indexQuotes: MiniQuote[];
  mag7Quotes: MiniQuote[];
  earnings: EarningsEntry[];
  headlines: string[];
}

async function gatherSnapshot(origin: string): Promise<BriefingSnapshot> {
  const [indexQuotes, mag7Quotes, earnings, headlines] = await Promise.all([
    fetchMiniQuotes(INDEX_SYMBOLS, origin),
    fetchMiniQuotes(MAG7_SYMBOLS, origin),
    fetchTodaysEarnings(),
    fetchHeadlines(),
  ]);

  return { indexQuotes, mag7Quotes, earnings, headlines };
}

function formatPercent(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

const SECTION_MARKERS = ["OVERNIGHT_NEWS:", "TODAYS_CATALYSTS:", "SECTOR_WATCH:"] as const;

// Renders the gathered snapshot into the exact data points the model may
// reason about, and asks for a fixed, labeled-section format so the
// response can be reliably split into three distinct cards rather than
// one undifferentiated paragraph — "no economic calendar data" note is
// included honestly rather than silently dropped, since this app has no
// such source to check yet.
function buildPrompt(snapshot: BriefingSnapshot): string {
  const indexLines = snapshot.indexQuotes
    .filter((quote) => quote.percentChange != null)
    .map((quote) => `${quote.symbol} ${formatPercent(quote.percentChange!)}`)
    .join(", ");

  const mag7Lines = snapshot.mag7Quotes
    .filter((quote) => quote.percentChange != null)
    .map((quote) => `${quote.symbol} ${formatPercent(quote.percentChange!)}`)
    .join(", ");

  const earningsLines =
    snapshot.earnings.length > 0
      ? snapshot.earnings
          .map((entry) => `${entry.name} (${entry.symbol})${entry.hour ? ` — reports ${entry.hour}` : ""}`)
          .join("\n")
      : "(none of this app's tracked companies report today)";

  const headlineLines =
    snapshot.headlines.length > 0
      ? snapshot.headlines.map((title) => `- ${title}`).join("\n")
      : "(no recent headlines available)";

  return `Here is today's market data:

Major indexes (ETF proxies): ${indexLines || "not available"}
Magnificent 7 performance: ${mag7Lines || "not available"}

Notable companies reporting earnings today:
${earningsLines}

Recent finance headlines (overnight through this morning):
${headlineLines}

Note: no economic calendar data (Fed meetings, CPI releases, etc.) is available — do not reference any economic events today.

Write a daily market briefing for a retail investor, plain language, strictly from the data above. Respond in exactly this format and nothing else — no preamble, no markdown formatting, no extra commentary:

OVERNIGHT_NEWS: <2-3 sentences summarizing the overnight/morning headlines above>
TODAYS_CATALYSTS: <2-3 sentences on today's earnings reports and what to watch for>
SECTOR_WATCH: <2-3 sentences on how the Magnificent 7 and major indexes are positioned>

Do not invent statistics, percentages, company names, or events that are not explicitly listed above. If a section has nothing real to report, write exactly "Nothing notable to report today." for that section instead of inventing content.`;
}

interface BriefingSections {
  overnightNews: string;
  todaysCatalysts: string;
  sectorWatch: string;
}

// Splits Claude's fixed-format response back into the three sections —
// each section runs from its own marker up to whichever marker comes
// next (or end of string for the last one).
function parseSections(raw: string): BriefingSections | null {
  const positions = SECTION_MARKERS.map((marker) => ({ marker, index: raw.indexOf(marker) }));
  if (positions.some((p) => p.index === -1)) return null;

  const sorted = [...positions].sort((a, b) => a.index - b.index);
  const values: Record<string, string> = {};

  for (let i = 0; i < sorted.length; i++) {
    const { marker, index } = sorted[i];
    const end = i + 1 < sorted.length ? sorted[i + 1].index : raw.length;
    values[marker] = raw.slice(index + marker.length, end).trim();
  }

  const overnightNews = values["OVERNIGHT_NEWS:"];
  const todaysCatalysts = values["TODAYS_CATALYSTS:"];
  const sectorWatch = values["SECTOR_WATCH:"];
  if (!overnightNews || !todaysCatalysts || !sectorWatch) return null;

  return { overnightNews, todaysCatalysts, sectorWatch };
}

async function generateBriefing(snapshot: BriefingSnapshot): Promise<BriefingSections | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;

  const hasAnyData =
    snapshot.indexQuotes.some((q) => q.percentChange != null) ||
    snapshot.mag7Quotes.some((q) => q.percentChange != null) ||
    snapshot.earnings.length > 0 ||
    snapshot.headlines.length > 0;
  if (!hasAnyData) return null;

  try {
    const anthropic = new Anthropic();
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 500,
      messages: [{ role: "user", content: buildPrompt(snapshot) }],
    });

    const textBlock = message.content.find((block) => block.type === "text");
    const raw = textBlock?.type === "text" ? textBlock.text.trim() : "";
    return raw ? parseSections(raw) : null;
  } catch (err) {
    console.error(
      `[daily-briefing] Anthropic request failed: ${err instanceof Error ? err.message : String(err)}`
    );
    return null;
  }
}

interface DailyBriefingResponse {
  overnightNews: string | null;
  todaysCatalysts: string | null;
  sectorWatch: string | null;
  generatedAt: string | null;
  available: boolean;
}

export async function GET(request: NextRequest) {
  const todayIso = new Date().toISOString().slice(0, 10);

  const data = await withCache(
    `daily-briefing:${todayIso}`,
    CACHE_TTL_MS,
    async (): Promise<DailyBriefingResponse> => {
      const snapshot = await gatherSnapshot(request.nextUrl.origin);
      const sections = await generateBriefing(snapshot);

      return {
        overnightNews: sections?.overnightNews ?? null,
        todaysCatalysts: sections?.todaysCatalysts ?? null,
        sectorWatch: sections?.sectorWatch ?? null,
        generatedAt: sections ? new Date().toISOString() : null,
        available: sections !== null,
      };
    }
  );

  return NextResponse.json(data);
}
