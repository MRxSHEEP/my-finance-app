import { NextRequest, NextResponse } from "next/server";
import { resolveTickerSymbol } from "@/lib/resolveTicker";
import { withCache } from "@/lib/newsCache";
import { fetchFmpBalanceSheet, fetchFmpCashFlow, fetchFmpIncomeStatement, type FmpPeriod } from "@/lib/fmp";

export const dynamic = "force-dynamic";

// FMP-exclusive data (no Finnhub equivalent) — cached for the same window
// as lib/fmp.ts's own per-call cache so repeat views of a ticker within
// that window don't redo the three-endpoint merge below either. Annual
// and quarterly are cached under separate keys (see the `period` suffix
// below), so toggling back and forth within the window never re-fetches
// either one twice.
const CACHE_TTL_MS = 4 * 60 * 60_000;
const ANNUAL_PERIODS = 4;
const QUARTERLY_PERIODS = 8;

interface StatementPeriod {
  // "FY 2025" for annual, "Q2 2026" for quarterly — built server-side so
  // the client never has to know FMP's own period-label convention.
  label: string;
  revenue: number | null;
  grossProfit: number | null;
  operatingIncome: number | null;
  netIncome: number | null;
  eps: number | null;
  totalAssets: number | null;
  totalLiabilities: number | null;
  totalStockholdersEquity: number | null;
  cashAndCashEquivalents: number | null;
  totalDebt: number | null;
  operatingCashFlow: number | null;
  capitalExpenditure: number | null;
  freeCashFlow: number | null;
  netDividendsPaid: number | null;
}

interface FinancialsData {
  ticker: string;
  period: FmpPeriod;
  periods: StatementPeriod[];
  available: boolean;
}

function emptyRow(label: string): StatementPeriod {
  return {
    label,
    revenue: null,
    grossProfit: null,
    operatingIncome: null,
    netIncome: null,
    eps: null,
    totalAssets: null,
    totalLiabilities: null,
    totalStockholdersEquity: null,
    cashAndCashEquivalents: null,
    totalDebt: null,
    operatingCashFlow: null,
    capitalExpenditure: null,
    freeCashFlow: null,
    netDividendsPaid: null,
  };
}

function labelFor(fiscalYear: string, period: string): string {
  return period && period !== "FY" ? `${period} ${fiscalYear}` : `FY ${fiscalYear}`;
}

// Sorting by the display label as a string would put "Q1 2026" before
// "Q2 2025" (alphabetically "1" < "2") despite Q2 2025 coming first
// chronologically — this builds a real numeric sort key instead.
const QUARTER_RANK: Record<string, number> = { Q1: 1, Q2: 2, Q3: 3, Q4: 4 };
function sortKeyFor(fiscalYear: string, period: string): number {
  const year = Number(fiscalYear);
  const rank = QUARTER_RANK[period] ?? 0;
  return (Number.isFinite(year) ? year : 0) * 10 + rank;
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("ticker")?.trim();
  if (!query) {
    return NextResponse.json(
      { error: "Missing required query parameter: ticker" },
      { status: 400 }
    );
  }

  const period: FmpPeriod = request.nextUrl.searchParams.get("period") === "quarter" ? "quarter" : "annual";
  const limit = period === "quarter" ? QUARTERLY_PERIODS : ANNUAL_PERIODS;

  const finnhubKey = process.env.FINNHUB_API_KEY;
  const ticker = finnhubKey ? await resolveTickerSymbol(query, finnhubKey) : query.toUpperCase();

  const data = await withCache(`financials:${ticker}:${period}`, CACHE_TTL_MS, async (): Promise<FinancialsData> => {
    const [income, balance, cashFlow] = await Promise.all([
      fetchFmpIncomeStatement(ticker, limit, period),
      fetchFmpBalanceSheet(ticker, limit, period),
      fetchFmpCashFlow(ticker, limit, period),
    ]);

    if (!income && !balance && !cashFlow) {
      return { ticker, period, periods: [], available: false };
    }

    // Each of the three FMP endpoints is its own call returning its own
    // array — merge by (period, fiscalYear) into one row per statement
    // period so revenue, net income, and free cash flow line up side by
    // side (this is exactly the shape the DCF calculator's inputs want),
    // rather than three tables a reader has to cross-reference by eye.
    // Keying on fiscalYear alone (as the old annual-only version did)
    // would collide four different quarters of the same year into one
    // row now that quarterly is an option, hence the composite key.
    const rows = new Map<string, StatementPeriod>();
    const sortKeys = new Map<string, number>();
    function getRow(fiscalYear: string, entryPeriod: string): StatementPeriod {
      const key = `${entryPeriod}-${fiscalYear}`;
      const existing = rows.get(key);
      if (existing) return existing;
      const fresh = emptyRow(labelFor(fiscalYear, entryPeriod));
      rows.set(key, fresh);
      sortKeys.set(key, sortKeyFor(fiscalYear, entryPeriod));
      return fresh;
    }

    for (const entry of income ?? []) {
      const row = getRow(entry.fiscalYear, entry.period);
      row.revenue = entry.revenue;
      row.grossProfit = entry.grossProfit;
      row.operatingIncome = entry.operatingIncome;
      row.netIncome = entry.netIncome;
      row.eps = entry.eps;
    }
    for (const entry of balance ?? []) {
      const row = getRow(entry.fiscalYear, entry.period);
      row.totalAssets = entry.totalAssets;
      row.totalLiabilities = entry.totalLiabilities;
      row.totalStockholdersEquity = entry.totalStockholdersEquity;
      row.cashAndCashEquivalents = entry.cashAndCashEquivalents;
      row.totalDebt = entry.totalDebt;
    }
    for (const entry of cashFlow ?? []) {
      const row = getRow(entry.fiscalYear, entry.period);
      row.operatingCashFlow = entry.operatingCashFlow;
      row.capitalExpenditure = entry.capitalExpenditure;
      row.freeCashFlow = entry.freeCashFlow;
      row.netDividendsPaid = entry.netDividendsPaid;
    }

    const sortedPeriods = Array.from(rows.entries())
      .sort((a, b) => (sortKeys.get(b[0]) ?? 0) - (sortKeys.get(a[0]) ?? 0))
      .map(([, row]) => row);

    return { ticker, period, periods: sortedPeriods, available: sortedPeriods.length > 0 };
  });

  return NextResponse.json(data);
}
