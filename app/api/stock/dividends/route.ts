import { NextRequest, NextResponse } from "next/server";
import { resolveTickerSymbol } from "@/lib/resolveTicker";
import { withCache } from "@/lib/newsCache";

export const dynamic = "force-dynamic";

const CACHE_TTL_MS = 30 * 60_000;
const HISTORY_LIMIT = 12;
const TRAILING_YEAR_DAYS = 365;

interface DividendPoint {
  date: string;
  amount: number;
}

interface DividendData {
  hasDividends: boolean;
  lastExDate: string | null;
  // Sum of payments in the trailing 12 months, not a fixed "x4 quarters"
  // assumption — some payers are monthly/semi-annual, so this stays
  // correct regardless of frequency. The card computes yield% from this
  // using the current price already loaded on the stocks page, rather
  // than this route fetching a price itself.
  annualDividendPerShare: number | null;
  history: DividendPoint[];
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("ticker")?.trim();
  if (!query) {
    return NextResponse.json(
      { error: "Missing required query parameter: ticker" },
      { status: 400 }
    );
  }

  const finnhubKey = process.env.FINNHUB_API_KEY;
  const polygonKey = process.env.POLYGON_API_KEY;
  const ticker = await resolveTickerSymbol(query, finnhubKey);

  const data = await withCache(`dividends:${ticker}`, CACHE_TTL_MS, async (): Promise<DividendData> => {
    const empty: DividendData = { hasDividends: false, lastExDate: null, annualDividendPerShare: null, history: [] };
    if (!polygonKey) return empty;

    // Finnhub's own /stock/dividend isn't reachable on this API tier
    // (confirmed live: "You don't have access to this resource").
    // Polygon's reference dividends endpoint covers the same data and is
    // already used elsewhere in this app (commodities' gold/silver
    // history) — confirmed live it works for both payers (JNJ) and
    // correctly returns an empty array for non-payers (TSLA), rather
    // than an error either way.
    const response = await fetch(
      `https://api.polygon.io/v3/reference/dividends?ticker=${encodeURIComponent(ticker)}&limit=${HISTORY_LIMIT}&apiKey=${polygonKey}`
    ).catch(() => null);
    if (!response?.ok) return empty;

    const body = await response.json().catch(() => null);
    const results: Array<{ ex_dividend_date: string; cash_amount: number }> = Array.isArray(body?.results)
      ? body.results
      : [];
    if (results.length === 0) return empty;

    // Polygon returns newest-first; the chart wants oldest-first.
    const history = results
      .map((entry) => ({ date: entry.ex_dividend_date, amount: entry.cash_amount }))
      .reverse();

    const cutoff = new Date();
    cutoff.setUTCDate(cutoff.getUTCDate() - TRAILING_YEAR_DAYS);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    const annualDividendPerShare = results
      .filter((entry) => entry.ex_dividend_date >= cutoffStr)
      .reduce((sum, entry) => sum + entry.cash_amount, 0);

    return {
      hasDividends: true,
      lastExDate: history[history.length - 1]?.date ?? null,
      annualDividendPerShare,
      history,
    };
  });

  return NextResponse.json(data);
}
