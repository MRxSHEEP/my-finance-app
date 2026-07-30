import { withCache } from "@/lib/newsCache";

const FMP_BASE = "https://financialmodelingprep.com/stable";

// FMP's free tier is capped at 250 calls/day — cache aggressively per
// (endpoint, params) combination so repeated views of the same ticker
// within a session (or across users/tabs) don't re-spend the daily quota.
// A failed/restricted response is cached too (not just successes) so a
// permanently-403'd endpoint (see fetchFmpInsiderTrading below) doesn't
// get re-attempted on every request within the window.
const CACHE_TTL_MS = 4 * 60 * 60_000;

async function fetchFmp<T>(endpoint: string, params: Record<string, string>): Promise<T[] | null> {
  const apiKey = process.env.FMP_API_KEY;
  if (!apiKey) return null;

  const cacheKey = `fmp:${endpoint}:${new URLSearchParams(params).toString()}`;

  return withCache(cacheKey, CACHE_TTL_MS, async (): Promise<T[] | null> => {
    const search = new URLSearchParams({ ...params, apikey: apiKey });
    try {
      const response = await fetch(`${FMP_BASE}/${endpoint}?${search.toString()}`);
      if (!response.ok) {
        console.warn(`[fmp] ${endpoint} request failed (status ${response.status})`);
        return null;
      }
      const body = await response.json().catch(() => null);
      return Array.isArray(body) ? (body as T[]) : null;
    } catch (err) {
      console.warn(`[fmp] ${endpoint} request threw:`, err);
      return null;
    }
  });
}

export interface FmpProfile {
  symbol: string;
  price: number | null;
  marketCap: number | null;
  beta: number | null;
  companyName: string;
  industry: string | null;
  // Real, professionally-written company description — replaces the
  // Claude-paraphrased one-sentence summary app/api/stock/overview/route.ts
  // used to generate from no real data at all (confirmed live: it once
  // fabricated "Singapore Airlines" for ticker SQ, mixing up the stock
  // symbol with an airline IATA code — the exact failure mode grounding is
  // meant to prevent).
  description: string | null;
  ceo: string | null;
  // FMP returns this as a numeric string (e.g. "166000"), not a number.
  fullTimeEmployees: string | null;
  city: string | null;
  state: string | null;
  // Date the stock went public — NOT the company's founding date (FMP has
  // no structured "founded" field at all; the closest it gets is
  // sometimes mentioning a founding year in the free-text description
  // above, with no reliable format to parse). Always label this "IPO
  // Date" wherever it's shown, never "Founded."
  ipoDate: string | null;
}

export async function fetchFmpProfile(ticker: string): Promise<FmpProfile | null> {
  const rows = await fetchFmp<FmpProfile>("profile", { symbol: ticker });
  return rows?.[0] ?? null;
}

export interface FmpRatios {
  priceToEarningsRatio: number | null;
}

export async function fetchFmpRatios(ticker: string): Promise<FmpRatios | null> {
  const rows = await fetchFmp<FmpRatios>("ratios", { symbol: ticker, limit: "1" });
  return rows?.[0] ?? null;
}

export interface FmpIncomeStatement {
  date: string;
  fiscalYear: string;
  period: string;
  revenue: number;
  grossProfit: number;
  operatingIncome: number;
  netIncome: number;
  eps: number | null;
  ebitda: number | null;
}

export type FmpPeriod = "annual" | "quarter";

export async function fetchFmpIncomeStatement(
  ticker: string,
  limit = 4,
  period: FmpPeriod = "annual"
): Promise<FmpIncomeStatement[] | null> {
  return fetchFmp<FmpIncomeStatement>("income-statement", {
    symbol: ticker,
    period,
    limit: String(limit),
  });
}

export interface FmpBalanceSheet {
  date: string;
  fiscalYear: string;
  period: string;
  totalAssets: number;
  totalLiabilities: number;
  totalStockholdersEquity: number;
  cashAndCashEquivalents: number;
  totalDebt: number;
}

export async function fetchFmpBalanceSheet(
  ticker: string,
  limit = 4,
  period: FmpPeriod = "annual"
): Promise<FmpBalanceSheet[] | null> {
  return fetchFmp<FmpBalanceSheet>("balance-sheet-statement", {
    symbol: ticker,
    period,
    limit: String(limit),
  });
}

export interface FmpCashFlow {
  date: string;
  fiscalYear: string;
  period: string;
  operatingCashFlow: number;
  capitalExpenditure: number;
  freeCashFlow: number;
  netDividendsPaid: number;
}

export async function fetchFmpCashFlow(
  ticker: string,
  limit = 4,
  period: FmpPeriod = "annual"
): Promise<FmpCashFlow[] | null> {
  return fetchFmp<FmpCashFlow>("cash-flow-statement", {
    symbol: ticker,
    period,
    limit: String(limit),
  });
}

export interface FmpEarnings {
  date: string;
  epsActual: number | null;
  epsEstimated: number | null;
  revenueActual: number | null;
  revenueEstimated: number | null;
}

// FMP's free tier caps `limit` at 5 for this endpoint (confirmed live —
// higher values return a 402 rather than clamping silently).
export async function fetchFmpEarnings(ticker: string, limit = 5): Promise<FmpEarnings[] | null> {
  return fetchFmp<FmpEarnings>("earnings", { symbol: ticker, limit: String(Math.min(limit, 5)) });
}

export interface FmpGrade {
  date: string;
  gradingCompany: string;
  previousGrade: string;
  newGrade: string;
  // FMP labels this explicitly — no need to derive direction ourselves
  // from comparing grade text (which would require an ordered rating
  // scale that varies by grading firm's own vocabulary).
  action: "upgrade" | "downgrade" | "maintain" | string;
}

// Individual analyst rating actions (not literal price-target dollar
// revisions — FMP's dedicated price-target-revision endpoint is
// restricted on this plan, confirmed live). Returned newest-first.
export async function fetchFmpGrades(ticker: string): Promise<FmpGrade[] | null> {
  return fetchFmp<FmpGrade>("grades", { symbol: ticker });
}

export interface FmpRevenueSegmentation {
  symbol: string;
  fiscalYear: number;
  period: string;
  date: string;
  // Segment/product or geography name -> revenue in raw dollars.
  data: Record<string, number>;
}

// Quarterly granularity is premium-restricted on this plan (confirmed
// live: 402 for period=quarter) — only the default annual (period=FY)
// resolves, so this always returns a full-fiscal-year mix, never a
// single quarter's. Callers must label it by fiscal year, not by
// whichever specific quarter's report they're showing it alongside.
export async function fetchFmpRevenueSegmentation(ticker: string): Promise<FmpRevenueSegmentation[] | null> {
  return fetchFmp<FmpRevenueSegmentation>("revenue-product-segmentation", { symbol: ticker });
}

export interface FmpInsiderTrade {
  transactionDate: string;
  reportingName: string;
  transactionType: string;
  securitiesTransacted: number;
  price: number;
}

// Confirmed live (2026-07): this endpoint returns 402 "Restricted Endpoint"
// on the free tier regardless of query params — it's not available at all
// under the current plan, not merely rate-limited. The call is still wired
// up (rather than omitted) so insider-trading cross-referencing starts
// working automatically if the plan is ever upgraded; today it always
// resolves to null and the existing Finnhub-based card is unaffected.
export async function fetchFmpInsiderTrading(
  ticker: string,
  limit = 15
): Promise<FmpInsiderTrade[] | null> {
  return fetchFmp<FmpInsiderTrade>("insider-trading/search", { symbol: ticker, limit: String(limit) });
}
