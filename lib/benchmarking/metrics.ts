import { fetchFmpIncomeStatement, fetchFmpCashFlow } from "@/lib/fmp";

export interface TickerMetrics {
  revenueGrowth: number | null;
  grossMargin: number | null;
  fcfYield: number | null;
  forwardPE: number | null;
  evEbitda: number | null;
  // Labeled ROE (not ROIC) throughout — Finnhub's free metric set has no
  // ROIC, only ROA/ROE. Matches app/api/screener/route.ts's own precedent:
  // surface ROE honestly rather than presenting it as an ROIC substitute.
  roe: number | null;
}

interface FinnhubMetricAll {
  forwardPE?: number;
  revenueGrowthTTMYoy?: number;
  evEbitdaTTM?: number;
  roeTTM?: number;
  // Reported in millions of the local currency — same convention already
  // documented in app/api/stock/peers/route.ts / app/api/stock/fundamentals/route.ts.
  marketCapitalization?: number;
}

// A small, self-contained copy of the same Finnhub `stock/metric?metric=all`
// call already made independently in app/api/stock/peers/route.ts,
// app/api/screener/route.ts, and app/api/stock/overview/route.ts — no
// shared exported helper exists for it anywhere in this codebase today.
// Duplicating this one small fetch is the same "small intentional
// duplication of already-precedented fetch logic" this app already accepts
// elsewhere (see lib/simulatedTrading/pricing.ts's own commented rationale)
// rather than risking a refactor of three separate, already-working,
// rate-limit-tuned routes.
async function fetchFinnhubMetricAll(ticker: string, apiKey: string): Promise<FinnhubMetricAll | null> {
  try {
    const response = await fetch(
      `https://finnhub.io/api/v1/stock/metric?symbol=${encodeURIComponent(ticker)}&metric=all&token=${apiKey}`
    );
    if (!response.ok) return null;
    const body = await response.json().catch(() => null);
    return body?.metric ?? null;
  } catch {
    return null;
  }
}

// Computes all 6 benchmarking metrics for one ticker. Revenue growth,
// forward P/E, EV/EBITDA, and ROE are direct Finnhub metric=all passthroughs
// (same fields already relied on elsewhere in this app). Gross margin and
// FCF yield are new — this app has never computed either ratio before —
// built from lib/fmp.ts's already-exported, unmodified
// fetchFmpIncomeStatement/fetchFmpCashFlow functions.
export async function computeTickerMetrics(ticker: string): Promise<TickerMetrics | null> {
  const apiKey = process.env.FINNHUB_API_KEY;

  const [finnhubMetric, incomeStatements, cashFlows] = await Promise.all([
    apiKey ? fetchFinnhubMetricAll(ticker, apiKey) : Promise.resolve(null),
    fetchFmpIncomeStatement(ticker, 1, "annual"),
    fetchFmpCashFlow(ticker, 1, "annual"),
  ]);

  if (!finnhubMetric && !incomeStatements?.length && !cashFlows?.length) return null;

  // Finnhub's marketCapitalization is in MILLIONS; FMP's freeCashFlow is in
  // raw dollars — this conversion must happen before dividing, or the yield
  // comes out six orders of magnitude wrong.
  const marketCap =
    typeof finnhubMetric?.marketCapitalization === "number" ? finnhubMetric.marketCapitalization * 1_000_000 : null;

  const latestIncome = incomeStatements?.[0];
  const grossMargin =
    latestIncome && latestIncome.revenue > 0 ? (latestIncome.grossProfit / latestIncome.revenue) * 100 : null;

  const latestCashFlow = cashFlows?.[0];
  const fcfYield =
    latestCashFlow && marketCap != null && marketCap > 0 ? (latestCashFlow.freeCashFlow / marketCap) * 100 : null;

  return {
    revenueGrowth: typeof finnhubMetric?.revenueGrowthTTMYoy === "number" ? finnhubMetric.revenueGrowthTTMYoy : null,
    grossMargin,
    fcfYield,
    forwardPE: typeof finnhubMetric?.forwardPE === "number" ? finnhubMetric.forwardPE : null,
    evEbitda: typeof finnhubMetric?.evEbitdaTTM === "number" ? finnhubMetric.evEbitdaTTM : null,
    roe: typeof finnhubMetric?.roeTTM === "number" ? finnhubMetric.roeTTM : null,
  };
}
