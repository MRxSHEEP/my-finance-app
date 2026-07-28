// Fictional/real-hybrid data for the Peer Benchmarking Preview walkthrough
// (components/benchmarking/preview/BenchmarkingWalkthrough.tsx). The peer
// set itself (GOOGL as "own company", AAPL/MSFT as peers) and every metric
// value below are the REAL, live-computed lib/benchmarking/metrics.ts
// output verified during this session's ticker-validation bug fix — not
// invented figures. Only the org name and the trend history's earlier
// points (there being no real multi-day history yet for that fix) are
// fictional.

// Reused from the Compliance walkthrough's own sample data rather than
// duplicated — same fictional firm across all four previews.
export { DEMO_ORG_NAME } from "@/components/compliance/preview/sampleData";

export interface DemoTicker {
  ticker: string;
  isOwnCompany: boolean;
  revenueGrowth: number;
  grossMargin: number;
  fcfYield: number;
  forwardPE: number;
  evEbitda: number;
  roe: number;
}

// Real lib/benchmarking/metrics.ts output for GOOGL/AAPL/MSFT, fetched live
// and verified against the database during this session's peer-set
// ticker-validation fix.
export const DEMO_TICKERS: DemoTicker[] = [
  { ticker: "GOOGL", isOwnCompany: true, revenueGrowth: 20.05, grossMargin: 59.67, fcfYield: 1.84, forwardPE: 24.15, evEbitda: 25.64, roe: 50.84 },
  { ticker: "AAPL", isOwnCompany: false, revenueGrowth: 12.76, grossMargin: 46.91, fcfYield: 2.0, forwardPE: 31.14, evEbitda: 31.11, roe: 146.69 },
  { ticker: "MSFT", isOwnCompany: false, revenueGrowth: 17.87, grossMargin: 68.82, fcfYield: 2.47, forwardPE: 19.32, evEbitda: 15.84, roe: 33.13 },
];

// Revenue Growth history for the featured trend scene — 5 weekly points
// each ending exactly at that ticker's real current value above (only the
// earlier points, standing in for history the real peer set hasn't
// accumulated yet, are invented).
const DAY_S = 86_400;
const now = Math.floor(new Date("2026-07-28T00:00:00.000Z").getTime() / 1000);
function weeklyPoints(values: number[]): { time: number; value: number }[] {
  return values.map((value, i) => ({ time: now - (values.length - 1 - i) * 7 * DAY_S, value }));
}

export const DEMO_REVENUE_GROWTH_TREND: Record<string, { time: number; value: number }[]> = {
  GOOGL: weeklyPoints([18.2, 18.9, 19.3, 19.7, 20.05]),
  AAPL: weeklyPoints([11.0, 11.5, 11.9, 12.3, 12.76]),
  MSFT: weeklyPoints([16.5, 16.9, 17.3, 17.6, 17.87]),
};
