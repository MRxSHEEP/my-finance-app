// Fictional data for the Model Portfolios Preview walkthrough
// (components/modelPortfolios/preview/ModelPortfoliosWalkthrough.tsx).
// Nothing here is fetched except where explicitly noted — every scene
// renders straight from these constants, or from a real live component fed
// these constants as props — and every name/figure is deliberately invented
// so it can't be mistaken for a real portfolio.

// Reused from the Compliance walkthrough's own sample data rather than
// duplicated — same fictional firm across all three previews.
export { DEMO_ORG_NAME } from "@/components/compliance/preview/sampleData";

export const DEMO_PORTFOLIO_NAME = "Core Growth Model";

// "Current" prices are real, live quotes (fetched once, see this file's own
// generation) for VOO/QQQ/VNQ — genuine ETFs, not invented tickers.
// "Price at Creation" is invented (a plausible ~90-days-ago starting
// point); the resulting return is real arithmetic on a real current price,
// not a fabricated percentage.
export const DEMO_HOLDINGS = [
  { assetType: "stock" as const, symbol: "VOO", name: "Vanguard S&P 500 ETF", targetWeightPercent: 50, priceAtCreation: 645.0, currentPrice: 679.31 },
  { assetType: "stock" as const, symbol: "QQQ", name: "Invesco QQQ Trust", targetWeightPercent: 30, priceAtCreation: 612.0, currentPrice: 682.12 },
  { assetType: "stock" as const, symbol: "VNQ", name: "Vanguard Real Estate ETF", targetWeightPercent: 20, priceAtCreation: 94.0, currentPrice: 100.54 },
];

export const DEMO_CREATED_AT = "2026-04-29T00:00:00.000Z";

// Weekly points, $10,000 notional (NOTIONAL_BASE) trending up with minor
// realistic noise to a weighted blend of the three holdings' own real
// returns above (≈ +7.5%) — not a round, suspiciously-clean number.
export const DEMO_PERFORMANCE_SERIES = [
  { date: "2026-04-29", value: 10000 },
  { date: "2026-05-06", value: 10120 },
  { date: "2026-05-13", value: 9980 },
  { date: "2026-05-20", value: 10210 },
  { date: "2026-05-27", value: 10340 },
  { date: "2026-06-03", value: 10280 },
  { date: "2026-06-10", value: 10460 },
  { date: "2026-06-17", value: 10390 },
  { date: "2026-06-24", value: 10580 },
  { date: "2026-07-01", value: 10510 },
  { date: "2026-07-08", value: 10690 },
  { date: "2026-07-15", value: 10620 },
  { date: "2026-07-22", value: 10750 },
];

export const DEMO_TOTAL_VALUE = DEMO_PERFORMANCE_SERIES[DEMO_PERFORMANCE_SERIES.length - 1].value;
export const DEMO_TOTAL_RETURN = DEMO_TOTAL_VALUE - 10000;
export const DEMO_TOTAL_RETURN_PERCENT = (DEMO_TOTAL_RETURN / 10000) * 100;

export const DEMO_SHARE_TOKEN = "8f3a1c9d2b7e4f6a0d5c8b1e3f7a9c2d";
