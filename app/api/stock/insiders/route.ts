import { NextRequest, NextResponse } from "next/server";
import { resolveTickerSymbol } from "@/lib/resolveTicker";
import { withCache } from "@/lib/newsCache";
import { fetchFmpInsiderTrading, type FmpInsiderTrade } from "@/lib/fmp";

export const dynamic = "force-dynamic";

const CACHE_TTL_MS = 10 * 60_000;
const MAX_TRANSACTIONS = 15;
const NET_SENTIMENT_WINDOW_DAYS = 90;

// SEC Form 4 transaction codes, the common ones — friendlier than
// showing a bare single letter in the list.
const CODE_LABELS: Record<string, string> = {
  P: "Purchase",
  S: "Sale",
  A: "Award",
  G: "Gift",
  F: "Tax Withholding",
  M: "Option Exercise",
  X: "Option Exercise",
  C: "Conversion",
  D: "Disposition",
};

interface RawTransaction {
  name: string;
  share: number;
  change: number;
  transactionDate: string;
  transactionCode: string;
  transactionPrice: number;
}

interface InsiderTransactionOut {
  name: string;
  role: string;
  codeLabel: string;
  isBuy: boolean;
  isSell: boolean;
  shares: number;
  value: number;
  transactionDate: string;
}

interface InsiderData {
  transactions: InsiderTransactionOut[];
  netSentiment: { label: "Net Buying" | "Net Selling"; netValue: number } | null;
}

// Shared shape both providers get normalized into, so the transaction
// list and the net-sentiment calculation below only have to reason about
// one classification of "is this an open-market buy/sell" regardless of
// source.
interface NormalizedTrade {
  name: string;
  codeLabel: string;
  isBuy: boolean;
  isSell: boolean;
  shares: number;
  value: number;
  transactionDate: string;
}

function normalizeFinnhub(entries: RawTransaction[]): NormalizedTrade[] {
  return entries.map((entry) => ({
    name: entry.name,
    codeLabel: CODE_LABELS[entry.transactionCode] ?? entry.transactionCode,
    isBuy: entry.transactionCode === "P",
    isSell: entry.transactionCode === "S",
    shares: Math.abs(entry.change),
    value: Math.abs(entry.change) * entry.transactionPrice,
    transactionDate: entry.transactionDate,
  }));
}

// FMP's insider-trading endpoint is restricted on the free tier (confirmed
// live — 402 regardless of params), so its exact transactionType
// vocabulary can't be verified against this account. Classify defensively
// by substring match rather than an exact code table; anything that
// doesn't clearly read as a buy or sell is shown as neither rather than
// guessed.
function normalizeFmp(entries: FmpInsiderTrade[]): NormalizedTrade[] {
  return entries
    .filter((entry) => entry.transactionDate && entry.reportingName)
    .map((entry) => {
      const type = entry.transactionType?.toLowerCase() ?? "";
      const isBuy = type.includes("purchase") || type.includes("buy");
      const isSell = type.includes("sale") || type.includes("sell");
      const shares = Math.abs(entry.securitiesTransacted ?? 0);
      return {
        name: entry.reportingName,
        codeLabel: isBuy ? "Purchase" : isSell ? "Sale" : entry.transactionType || "Other",
        isBuy,
        isSell,
        shares,
        value: shares * (entry.price ?? 0),
        transactionDate: entry.transactionDate.slice(0, 10),
      };
    });
}

// Same SEC filing reported by both providers should count once — matched
// on date + filer + share count rather than a shared ID, since neither
// provider exposes one that lines up with the other's.
function dedupeKey(trade: NormalizedTrade): string {
  return `${trade.transactionDate}:${trade.name.toLowerCase()}:${trade.shares}`;
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("ticker")?.trim();
  if (!query) {
    return NextResponse.json(
      { error: "Missing required query parameter: ticker" },
      { status: 400 }
    );
  }

  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Server is missing FINNHUB_API_KEY configuration" },
      { status: 500 }
    );
  }

  const ticker = await resolveTickerSymbol(query, apiKey);

  const data = await withCache(`insiders:${ticker}`, CACHE_TTL_MS, async (): Promise<InsiderData> => {
    const [finnhubResponse, fmpTrades] = await Promise.all([
      fetch(
        `https://finnhub.io/api/v1/stock/insider-transactions?symbol=${encodeURIComponent(ticker)}&token=${apiKey}`
      ).catch(() => null),
      fetchFmpInsiderTrading(ticker),
    ]);

    let finnhubRaw: RawTransaction[] = [];
    if (finnhubResponse?.ok) {
      const finnhubBody = await finnhubResponse.json().catch(() => null);
      finnhubRaw = Array.isArray(finnhubBody?.data) ? finnhubBody.data : [];
    }

    if (finnhubRaw.length === 0 && !fmpTrades) {
      return { transactions: [], netSentiment: null };
    }

    // Finnhub doesn't return a role/title per filer — SEC Form 4 data
    // doesn't carry it either without a separate lookup, so the row just
    // shows the name; role is omitted rather than faked.
    const merged = new Map<string, NormalizedTrade>();
    for (const trade of [...normalizeFinnhub(finnhubRaw), ...normalizeFmp(fmpTrades ?? [])]) {
      const key = dedupeKey(trade);
      if (!merged.has(key)) merged.set(key, trade);
    }
    const allTrades = Array.from(merged.values());

    const transactions: InsiderTransactionOut[] = allTrades
      .slice()
      .sort((a, b) => b.transactionDate.localeCompare(a.transactionDate))
      .slice(0, MAX_TRANSACTIONS)
      .map((trade) => ({
        name: trade.name,
        role: "",
        codeLabel: trade.codeLabel,
        isBuy: trade.isBuy,
        isSell: trade.isSell,
        shares: trade.shares,
        value: trade.value,
        transactionDate: trade.transactionDate,
      }));

    // Net sentiment: only genuine open-market buys/sells count — grants,
    // gifts, tax withholding, and option exercises aren't a "the insider
    // chose to buy/sell" signal and would muddy the number.
    const cutoff = new Date();
    cutoff.setUTCDate(cutoff.getUTCDate() - NET_SENTIMENT_WINDOW_DAYS);
    const cutoffStr = cutoff.toISOString().slice(0, 10);

    const recentTrades = allTrades.filter(
      (trade) => trade.transactionDate >= cutoffStr && (trade.isBuy || trade.isSell)
    );

    if (recentTrades.length === 0) {
      return { transactions, netSentiment: null };
    }

    const netValue = recentTrades.reduce(
      (sum, trade) => sum + (trade.isBuy ? trade.value : -trade.value),
      0
    );

    return {
      transactions,
      netSentiment: { label: netValue >= 0 ? "Net Buying" : "Net Selling", netValue },
    };
  });

  return NextResponse.json(data);
}
