import { NextRequest, NextResponse } from "next/server";
import { resolveTickerSymbol } from "@/lib/resolveTicker";
import { withCache } from "@/lib/newsCache";

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
    const response = await fetch(
      `https://finnhub.io/api/v1/stock/insider-transactions?symbol=${encodeURIComponent(ticker)}&token=${apiKey}`
    ).catch(() => null);

    if (!response?.ok) {
      return { transactions: [], netSentiment: null };
    }

    const body = await response.json().catch(() => null);
    const raw: RawTransaction[] = Array.isArray(body?.data) ? body.data : [];

    // Finnhub doesn't return a role/title per filer — SEC Form 4 data
    // doesn't carry it either without a separate lookup, so the row just
    // shows the name; role is omitted rather than faked.
    const transactions: InsiderTransactionOut[] = raw
      .slice()
      .sort((a, b) => b.transactionDate.localeCompare(a.transactionDate))
      .slice(0, MAX_TRANSACTIONS)
      .map((entry) => ({
        name: entry.name,
        role: "",
        codeLabel: CODE_LABELS[entry.transactionCode] ?? entry.transactionCode,
        isBuy: entry.transactionCode === "P",
        isSell: entry.transactionCode === "S",
        shares: Math.abs(entry.change),
        value: Math.abs(entry.change) * entry.transactionPrice,
        transactionDate: entry.transactionDate,
      }));

    // Net sentiment: only genuine open-market Purchase(P)/Sale(S) codes
    // count — grants, gifts, tax withholding, and option exercises aren't
    // a "the insider chose to buy/sell" signal and would muddy the number.
    const cutoff = new Date();
    cutoff.setUTCDate(cutoff.getUTCDate() - NET_SENTIMENT_WINDOW_DAYS);
    const cutoffStr = cutoff.toISOString().slice(0, 10);

    const recentTrades = raw.filter(
      (entry) =>
        entry.transactionDate >= cutoffStr &&
        (entry.transactionCode === "P" || entry.transactionCode === "S")
    );

    if (recentTrades.length === 0) {
      return { transactions, netSentiment: null };
    }

    const netValue = recentTrades.reduce((sum, entry) => {
      const value = Math.abs(entry.change) * entry.transactionPrice;
      return sum + (entry.transactionCode === "P" ? value : -value);
    }, 0);

    return {
      transactions,
      netSentiment: { label: netValue >= 0 ? "Net Buying" : "Net Selling", netValue },
    };
  });

  return NextResponse.json(data);
}
