// Fictional data for the Reporting Preview walkthrough
// (components/reporting/preview/ReportingWalkthrough.tsx). Nothing here is
// fetched — every scene renders straight from these constants — and every
// name/ticker/figure is deliberately invented so it can't be mistaken for a
// real client, portfolio, or firm.

// Reused from the Compliance walkthrough's own sample data rather than
// duplicated — same fictional firm across both previews, one source of
// truth for the name.
export { DEMO_ORG_NAME } from "@/components/compliance/preview/sampleData";

export const DEMO_CLIENT_NAME = "Dana Ferris";
export const DEMO_ADVISOR_NAME = "Morgan Ellis";

export const DEMO_PORTFOLIO_HOLDINGS = [
  { symbol: "MSFT", name: "Microsoft Corp.", value: 210000, percent: 42 },
  { symbol: "AAPL", name: "Apple Inc.", value: 185000, percent: 37 },
  { symbol: "NVDA", name: "NVIDIA Corp.", value: 105000, percent: 21 },
];
export const DEMO_PORTFOLIO_TOTAL = 500000;

// Real calculateDcf({fcf: 50_000_000, growthRatePercent: 8, discountRatePercent: 10,
// years: 5, terminalGrowthPercent: 2.5, shares: 200_000_000}) output — computed via
// lib/calculators/dcf.ts, not invented, so the demo shows the same math a real
// run would produce for these inputs.
export const DEMO_DCF_INPUTS = {
  fcf: "50,000,000",
  growthRate: "8",
  discountRate: "10",
  years: "5",
  terminalGrowth: "2.5",
  shares: "200,000,000",
};
export const DEMO_DCF_RESULT = {
  intrinsicValue: "$860.12M",
  fairValuePerShare: "$4.30",
};

// Compliance Copilot's own DEMO_AI_REVIEW (sampleData.ts) established this
// "cite the specific data points" tone for AI-generated draft text — this
// narrative follows the same principle: a client-facing paragraph reads
// like the app's real AI Commentary output, mixing a /signals-style rating
// (see lib/signals/watchlist.ts) with a plain earnings/price observation
// for the ticker that has none, exactly as the real feature would.
export const DEMO_AI_COMMENTARY = {
  draft:
    "Dana Ferris's portfolio totals $500,000, with Microsoft the largest position at $210,000 (42%). MSFT carries a bullish /signals rating (72/100 confidence), supported by strong cloud growth and four consecutive quarters of earnings beats. Apple, at $185,000 (37%), is trading near its 50-day average following a modest +1.1% earnings surprise last quarter. NVIDIA rounds out the portfolio at $105,000 (21%) — it has risen sharply on continued AI-chip demand, though no /signals rating is yet available for further context.",
  editedAddition: " Overall positioning remains growth-tilted; no rebalancing action is recommended at this time.",
};
