import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { withCache } from "@/lib/newsCache";
import { fetchStockSparklines, type SparklinePoint } from "@/lib/sparklineFetch";

export const dynamic = "force-dynamic";

// Matches lib/sparklineFetch.ts's own cache TTL — the 1W/1M figures below
// are derived from that same throttled TwelveData history, so refreshing
// this route's cache any faster than that history itself updates would
// just recompute identical numbers. A cold cache here also has to wait
// out that module's ~7.6s/symbol throttle across all 11 ETFs (~85s worst
// case) — expensive, but only paid once per TTL window, not per request.
const CACHE_TTL_MS = 25 * 60_000;

const SECTOR_ETFS: Array<{ symbol: string; name: string }> = [
  { symbol: "XLK", name: "Technology" },
  { symbol: "XLF", name: "Financials" },
  { symbol: "XLE", name: "Energy" },
  { symbol: "XLV", name: "Healthcare" },
  { symbol: "XLY", name: "Consumer Discretionary" },
  { symbol: "XLP", name: "Consumer Staples" },
  { symbol: "XLI", name: "Industrials" },
  { symbol: "XLU", name: "Utilities" },
  { symbol: "XLB", name: "Materials" },
  { symbol: "XLRE", name: "Real Estate" },
  { symbol: "XLC", name: "Communication Services" },
];

// Trading days, not calendar days — matches how the sparkline history
// itself is spaced (one point per trading day).
const ONE_WEEK_TRADING_DAYS = 5;
const ONE_MONTH_TRADING_DAYS = 21;

interface SectorPerformance {
  symbol: string;
  name: string;
  oneDay: number | null;
  oneWeek: number | null;
  oneMonth: number | null;
}

// Reuses /api/stock/mini-quotes for the 1-day figure specifically — it's
// Finnhub's own live intraday %change (same field the ticker bar and
// every other "today's move" figure in this app already shows), which is
// more accurate for "today" than diffing daily-close history that may
// not have rolled over to today's bar yet.
interface MiniQuote {
  symbol: string;
  percentChange: number | null;
}

async function fetchDayChanges(symbols: string[], origin: string): Promise<Map<string, number | null>> {
  const url = new URL(`/api/stock/mini-quotes?symbols=${symbols.join(",")}&sparkline=false`, origin);

  try {
    const response = await fetch(url);
    if (!response.ok) {
      const bodyText = await response.text().catch(() => "<failed to read body>");
      console.error(
        `[sector-heatmap] mini-quotes request failed — status ${response.status}\n  body: ${bodyText}`
      );
      return new Map();
    }
    const body = await response.json().catch(() => null);
    const quotes: MiniQuote[] = Array.isArray(body?.quotes) ? body.quotes : [];
    if (quotes.length === 0) {
      console.error(`[sector-heatmap] mini-quotes returned no quotes for: ${symbols.join(",")}`);
    }
    return new Map(quotes.map((q) => [q.symbol, q.percentChange]));
  } catch (err) {
    console.error(
      `[sector-heatmap] mini-quotes request threw: ${err instanceof Error ? err.message : String(err)}`
    );
    return new Map();
  }
}

// 1W/1M can only come from the daily-close history TwelveData provides
// (Finnhub's free tier has no historical-candle access for stocks,
// confirmed elsewhere in this app) — comparing the latest close to
// whichever close sits `daysBack` trading days earlier, clamped to
// whatever's actually available if the series came back shorter than
// requested (a genuine gap, not treated as "no data").
function computeChangeFromHistory(
  history: SparklinePoint[] | null,
  daysBack: number
): number | null {
  if (!history || history.length < 2) return null;
  const latest = history[history.length - 1].value;
  const pastIndex = Math.max(0, history.length - 1 - daysBack);
  const past = history[pastIndex].value;
  if (past === 0) return null;
  return ((latest - past) / past) * 100;
}

function formatPercent(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

async function generateInterpretation(sectors: SectorPerformance[]): Promise<string | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;

  const withData = sectors.filter((s) => s.oneDay !== null);
  if (withData.length === 0) return null;

  const lines = withData
    .map((s) => `${s.name} (${s.symbol}): ${formatPercent(s.oneDay!)}`)
    .join("\n");

  const prompt = `Here is today's 1-day % change for each S&P 500 sector ETF:

${lines}

In exactly one brief, plain-language sentence, describe the overall pattern — which sectors are leading, which are lagging, and whether the tilt looks "risk-on" (cyclical/growth sectors leading) or "risk-off" (defensive sectors leading). Do not invent specific dollar amounts, capital-flow figures, or causal reasons not evident from the numbers above — describe the pattern in the data, don't explain why it's happening. One sentence only, no preamble.`;

  try {
    const anthropic = new Anthropic();
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 100,
      messages: [{ role: "user", content: prompt }],
    });

    const textBlock = message.content.find((block) => block.type === "text");
    const generated = textBlock?.type === "text" ? textBlock.text.trim() : "";
    return generated || null;
  } catch (err) {
    console.error(
      `[sector-heatmap] Anthropic request failed: ${err instanceof Error ? err.message : String(err)}`
    );
    return null;
  }
}

interface SectorHeatmapResponse {
  sectors: SectorPerformance[];
  interpretation: string | null;
  generatedAt: string;
}

export async function GET(request: NextRequest) {
  const data = await withCache("sector-heatmap", CACHE_TTL_MS, async (): Promise<SectorHeatmapResponse> => {
    const symbols = SECTOR_ETFS.map((s) => s.symbol);

    const [dayChanges, sparklines] = await Promise.all([
      fetchDayChanges(symbols, request.nextUrl.origin),
      fetchStockSparklines(symbols),
    ]);

    const sectors: SectorPerformance[] = SECTOR_ETFS.map(({ symbol, name }) => {
      const history = sparklines.get(symbol)?.points ?? null;
      return {
        symbol,
        name,
        oneDay: dayChanges.get(symbol) ?? null,
        oneWeek: computeChangeFromHistory(history, ONE_WEEK_TRADING_DAYS),
        oneMonth: computeChangeFromHistory(history, ONE_MONTH_TRADING_DAYS),
      };
    });

    const interpretation = await generateInterpretation(sectors);

    return { sectors, interpretation, generatedAt: new Date().toISOString() };
  });

  return NextResponse.json(data);
}
