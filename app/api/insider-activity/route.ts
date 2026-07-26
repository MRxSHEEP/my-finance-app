import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { withCache } from "@/lib/newsCache";
import { STOCK_CATALOG } from "@/lib/stockCatalog";

export const dynamic = "force-dynamic";

// FMP's free tier caps this endpoint at 100 rows/request and page 0 only
// (page 1 confirmed 402 live) — this is a snapshot of "whatever's most
// recent market-wide right now," not a deep archive, so there's little
// value refreshing faster than the data itself actually turns over.
const CACHE_TTL_MS = 30 * 60_000;
const RECENT_WINDOW_DAYS = 30;
const MAX_FEED_ENTRIES = 25;
const FMP_BATCH_SIZE = 100;

// Institutional/13F data was investigated live and confirmed unavailable
// on the current FMP plan: institutional-ownership/latest AND
// institutional-ownership/extract both return 402 "Restricted Endpoint"
// (the same message the already-known-restricted per-symbol
// insider-trading/search endpoint returns) — a real, correctly-named
// endpoint that's plan-gated, not a 404 from guessing wrong names. Per
// the "if available on your plan" qualifier, this feed is insider
// activity only.

// A curated subset of lib/stockCatalog.ts's ~130 tickers, kept modest so
// a burst of per-ticker Finnhub calls stays comfortably within its
// 60/min free-tier cap — this is the guaranteed-baseline source (see
// fetchFinnhubInsiderActivity below) since FMP's market-wide feed alone
// can come back with zero recognizable names in its most recent 100
// rows on any given day (confirmed live: only 3 of 24 unique symbols in
// a sample batch were in this app's own curated catalog).
const MAJOR_COMPANY_TICKERS = [
  "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA",
  "JPM", "BAC", "GS", "JNJ", "UNH", "PFE", "XOM", "CVX",
  "WMT", "HD", "DIS", "NFLX", "BA",
];

const COMPANY_NAMES: Record<string, string> = {
  AAPL: "Apple", MSFT: "Microsoft", GOOGL: "Alphabet", AMZN: "Amazon",
  NVDA: "Nvidia", META: "Meta", TSLA: "Tesla", JPM: "JPMorgan Chase",
  BAC: "Bank of America", GS: "Goldman Sachs", JNJ: "Johnson & Johnson",
  UNH: "UnitedHealth Group", PFE: "Pfizer", XOM: "Exxon Mobil",
  CVX: "Chevron", WMT: "Walmart", HD: "Home Depot", DIS: "Walt Disney",
  NFLX: "Netflix", BA: "Boeing",
};

const CATALOG_NAME_BY_SYMBOL = new Map(STOCK_CATALOG.map((entry) => [entry.symbol, entry.name]));
const CATALOG_SYMBOLS = new Set(STOCK_CATALOG.map((entry) => entry.symbol));

interface FeedEntry {
  symbol: string;
  companyName: string;
  insiderName: string;
  action: "buy" | "sell";
  shares: number;
  value: number;
  transactionDate: string;
  source: "fmp" | "finnhub";
  // Only set when a genuine, code-computed comparison exists — see
  // buildComparisonFact below. Never inferred or estimated.
  comparisonFact: string | null;
}

// ---------------------------------------------------------------------
// FMP: market-wide recent filings, narrowed to recognizable names
// ---------------------------------------------------------------------

interface FmpLatestTrade {
  symbol: string;
  transactionDate: string;
  reportingName: string;
  transactionType: string;
  securitiesTransacted: number;
  price: number;
}

async function fetchFmpBatch(): Promise<FmpLatestTrade[]> {
  const apiKey = process.env.FMP_API_KEY;
  if (!apiKey) return [];

  try {
    const search = new URLSearchParams({
      page: "0",
      limit: String(FMP_BATCH_SIZE),
      apikey: apiKey,
    });
    const response = await fetch(
      `https://financialmodelingprep.com/stable/insider-trading/latest?${search.toString()}`
    );
    if (!response.ok) {
      const bodyText = await response.text().catch(() => "<failed to read body>");
      console.error(`[insider-activity] FMP request failed — status ${response.status}\n  body: ${bodyText}`);
      return [];
    }
    const body = await response.json().catch(() => null);
    return Array.isArray(body) ? body : [];
  } catch (err) {
    console.error(
      `[insider-activity] FMP request threw: ${err instanceof Error ? err.message : String(err)}`
    );
    return [];
  }
}

function classifyFmpAction(transactionType: string): "buy" | "sell" | null {
  const type = transactionType.toLowerCase();
  if (type.includes("purchase") || type.includes("buy")) return "buy";
  if (type.includes("sale") || type.includes("sell")) return "sell";
  return null;
}

// ---------------------------------------------------------------------
// Finnhub: per-ticker history for a curated list of major companies —
// the "history" part matters here (not just the latest row) since it's
// what makes a genuine "largest purchase in the available history"
// comparison possible, unlike FMP's single-snapshot batch above.
// ---------------------------------------------------------------------

interface FinnhubRawTransaction {
  name: string;
  share: number;
  change: number;
  transactionDate: string;
  transactionCode: string;
  transactionPrice: number;
}

async function fetchFinnhubHistory(symbol: string, apiKey: string): Promise<FinnhubRawTransaction[]> {
  try {
    const response = await fetch(
      `https://finnhub.io/api/v1/stock/insider-transactions?symbol=${encodeURIComponent(symbol)}&token=${apiKey}`
    );
    if (!response.ok) return [];
    const body = await response.json().catch(() => null);
    return Array.isArray(body?.data) ? body.data : [];
  } catch {
    return [];
  }
}

function classifyFinnhubAction(code: string): "buy" | "sell" | null {
  if (code === "P") return "buy";
  if (code === "S") return "sell";
  return null;
}

// Same date+name+shares key used by the per-ticker insiders card, so the
// same filing showing up via both FMP and Finnhub only counts once.
function dedupeKey(entry: { symbol: string; insiderName: string; transactionDate: string; shares: number }): string {
  return `${entry.symbol}:${entry.transactionDate}:${entry.insiderName.toLowerCase()}:${entry.shares}`;
}

async function generateNotes(
  candidates: Array<{ entry: FeedEntry; fact: string }>
): Promise<Map<string, string>> {
  const notes = new Map<string, string>();
  if (candidates.length === 0 || !process.env.ANTHROPIC_API_KEY) return notes;

  const numbered = candidates
    .map(
      (c, i) =>
        `${i + 1}. ${c.entry.insiderName} — ${c.entry.action === "buy" ? "bought" : "sold"} ${c.entry.shares.toLocaleString()} shares of ${c.entry.companyName} (${c.entry.symbol}) on ${c.entry.transactionDate}. Confirmed fact: ${c.fact}`
    )
    .join("\n");

  const prompt = `Here are some notable insider transactions, each with a confirmed comparative fact already established from real transaction data:

${numbered}

For each numbered entry, write one brief, natural-language sentence conveying that confirmed fact — nothing more. Do not add any number, percentage, dollar amount, or claim that isn't already stated above. Respond in exactly this format, one line per entry, nothing else:

1: <sentence>
2: <sentence>
(etc.)`;

  try {
    const anthropic = new Anthropic();
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 60 * candidates.length + 100,
      messages: [{ role: "user", content: prompt }],
    });

    const textBlock = message.content.find((block) => block.type === "text");
    const raw = textBlock?.type === "text" ? textBlock.text.trim() : "";

    for (const line of raw.split("\n")) {
      const match = line.match(/^(\d+):\s*(.+)$/);
      if (!match) continue;
      const index = Number(match[1]) - 1;
      const candidate = candidates[index];
      if (candidate) notes.set(dedupeKey(candidate.entry), match[2].trim());
    }
  } catch (err) {
    console.error(
      `[insider-activity] Anthropic request failed: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  return notes;
}

interface InsiderActivityResponse {
  entries: FeedEntry[];
  generatedAt: string;
}

export async function GET() {
  const data = await withCache("insider-activity", CACHE_TTL_MS, async (): Promise<InsiderActivityResponse> => {
    const finnhubKey = process.env.FINNHUB_API_KEY;

    const [fmpBatch, finnhubHistories] = await Promise.all([
      fetchFmpBatch(),
      finnhubKey
        ? Promise.all(
            MAJOR_COMPANY_TICKERS.map(
              async (symbol) => [symbol, await fetchFinnhubHistory(symbol, finnhubKey)] as const
            )
          )
        : Promise.resolve([]),
    ]);

    // FMP entries, narrowed to symbols this app's own catalog recognizes
    // as a well-known company — the raw batch is dominated by micro-cap
    // filers otherwise (confirmed live).
    const fmpEntries: FeedEntry[] = fmpBatch
      .filter((trade) => CATALOG_SYMBOLS.has(trade.symbol))
      .map((trade): FeedEntry | null => {
        const action = classifyFmpAction(trade.transactionType);
        if (!action) return null;
        const shares = Math.abs(trade.securitiesTransacted ?? 0);
        return {
          symbol: trade.symbol,
          companyName: CATALOG_NAME_BY_SYMBOL.get(trade.symbol) ?? trade.symbol,
          insiderName: trade.reportingName,
          action,
          shares,
          value: shares * (trade.price ?? 0),
          transactionDate: trade.transactionDate?.slice(0, 10),
          source: "fmp",
          comparisonFact: null,
        };
      })
      .filter((entry): entry is FeedEntry => entry !== null);

    // The single largest-value transaction across the WHOLE raw FMP
    // batch (before catalog-narrowing) is a genuine, code-computed fact
    // — "largest in this batch of recent market-wide filings" — even
    // though most of that batch never surfaces in the feed itself.
    let largestInFmpBatch: { insiderName: string; transactionDate: string; shares: number } | null = null;
    let largestFmpValue = -1;
    for (const trade of fmpBatch) {
      const action = classifyFmpAction(trade.transactionType);
      if (!action) continue;
      const shares = Math.abs(trade.securitiesTransacted ?? 0);
      const value = shares * (trade.price ?? 0);
      if (value > largestFmpValue) {
        largestFmpValue = value;
        largestInFmpBatch = { insiderName: trade.reportingName, transactionDate: trade.transactionDate?.slice(0, 10), shares };
      }
    }

    // Finnhub entries, keeping each ticker's full returned history so a
    // genuine "largest purchase/sale by this insider in the available
    // history" comparison can be computed per (ticker, insider) pair.
    const finnhubEntries: FeedEntry[] = [];
    const historyByInsiderKey = new Map<string, FeedEntry[]>();

    for (const [symbol, rawHistory] of finnhubHistories) {
      for (const raw of rawHistory) {
        const action = classifyFinnhubAction(raw.transactionCode);
        if (!action) continue;
        const shares = Math.abs(raw.change);
        const entry: FeedEntry = {
          symbol,
          companyName: COMPANY_NAMES[symbol] ?? symbol,
          insiderName: raw.name,
          action,
          shares,
          value: shares * raw.transactionPrice,
          transactionDate: raw.transactionDate,
          source: "finnhub",
          comparisonFact: null,
        };
        finnhubEntries.push(entry);

        const key = `${symbol}:${raw.name.toLowerCase()}`;
        const bucket = historyByInsiderKey.get(key) ?? [];
        bucket.push(entry);
        historyByInsiderKey.set(key, bucket);
      }
    }

    // Merge + dedupe (the same filing can surface via both sources).
    const merged = new Map<string, FeedEntry>();
    for (const entry of [...fmpEntries, ...finnhubEntries]) {
      const key = dedupeKey(entry);
      if (!merged.has(key)) merged.set(key, entry);
    }

    const cutoff = new Date();
    cutoff.setUTCDate(cutoff.getUTCDate() - RECENT_WINDOW_DAYS);
    const cutoffStr = cutoff.toISOString().slice(0, 10);

    const recentEntries = Array.from(merged.values())
      .filter((entry) => entry.transactionDate && entry.transactionDate >= cutoffStr)
      .sort((a, b) => b.value - a.value)
      .slice(0, MAX_FEED_ENTRIES);

    // Attach whichever genuine comparison fact applies, and collect the
    // (typically small) set of entries that get one, to send to Claude
    // for natural-language phrasing in a single batched call.
    const candidates: Array<{ entry: FeedEntry; fact: string }> = [];

    for (const entry of recentEntries) {
      if (entry.source === "finnhub") {
        const key = `${entry.symbol}:${entry.insiderName.toLowerCase()}`;
        const history = historyByInsiderKey.get(key) ?? [];
        const sameAction = history.filter((h) => h.action === entry.action);
        if (sameAction.length >= 2) {
          const isLargest = sameAction.every((h) => h.value <= entry.value);
          if (isLargest) {
            candidates.push({
              entry,
              fact: `this is the largest ${entry.action} by ${entry.insiderName} at ${entry.companyName} among the ${sameAction.length} such transactions available in Finnhub's recent filing history for this ticker`,
            });
          }
        }
      } else if (
        largestInFmpBatch &&
        entry.insiderName === largestInFmpBatch.insiderName &&
        entry.transactionDate === largestInFmpBatch.transactionDate &&
        entry.shares === largestInFmpBatch.shares
      ) {
        candidates.push({
          entry,
          fact: `this is the single largest-value insider transaction across the most recent 100 market-wide filings pulled from FMP`,
        });
      }
    }

    const notes = await generateNotes(candidates);
    for (const entry of recentEntries) {
      entry.comparisonFact = notes.get(dedupeKey(entry)) ?? null;
    }

    return { entries: recentEntries, generatedAt: new Date().toISOString() };
  });

  return NextResponse.json(data);
}
