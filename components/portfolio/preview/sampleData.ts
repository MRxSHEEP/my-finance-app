// Fictional/real-hybrid data for the Simulated Portfolio Preview
// walkthrough (components/portfolio/preview/SimulatedPortfolioWalkthrough.tsx).
// Deliberately has NO firm/organization name anywhere (unlike the other
// three "Advisor Tools" walkthroughs) — Simulated Portfolio has no
// organizational concept at all (SimulatedPortfolio belongs only to a
// userId in the schema), and the real feature never shows any firm
// branding, so inventing one here would misrepresent the product.

import { PORTFOLIO_TIERS } from "@/lib/simulatedTrading/tiers";

// Real tier table, not invented — the same lib/simulatedTrading/tiers.ts
// every real tier card reads from.
export const DEMO_TIER = PORTFOLIO_TIERS.find((t) => t.id === "growth")!;

// Real current quotes (AAPL via /api/stock/mini-quotes, NVDA likewise,
// bitcoin via CoinGecko) fetched live while building this walkthrough —
// only the cost-basis ("avg cost") side of each holding is invented, same
// "real where cheap, invented only for the earlier/hypothetical side"
// principle used in the other three walkthroughs' sample data.
export const DEMO_CREATED_AT = "2026-05-29T00:00:00.000Z";

export const DEMO_HOLDINGS_BEFORE_TRADE = [
  { assetType: "stock" as const, symbol: "AAPL", quantity: 15, averageCostBasis: 310.0, currentPrice: 336.91 },
  { assetType: "crypto" as const, symbol: "bitcoin", quantity: 0.05, averageCostBasis: 58000.0, currentPrice: 63131.0 },
];

export const DEMO_CASH_BEFORE_TRADE = 2450.0;
export const DEMO_TOTAL_VALUE_BEFORE_TRADE = 10660.2;
export const DEMO_TOTAL_RETURN_BEFORE_TRADE = 660.2;
export const DEMO_TOTAL_RETURN_PERCENT_BEFORE_TRADE = 6.6;

// The trade demonstrated in the Trade scene — a fresh Buy, so its own
// average cost basis equals its (real) execution price.
export const DEMO_TRADE = {
  assetType: "stock" as const,
  symbol: "NVDA",
  name: "NVIDIA Corp.",
  quantity: 10,
  price: 196.51,
};

// Holdings/cash AFTER the demonstrated trade — what the Holdings & Activity
// scene shows.
export const DEMO_HOLDINGS_AFTER_TRADE = [
  ...DEMO_HOLDINGS_BEFORE_TRADE,
  { assetType: "stock" as const, symbol: "NVDA", quantity: DEMO_TRADE.quantity, averageCostBasis: DEMO_TRADE.price, currentPrice: DEMO_TRADE.price },
];
export const DEMO_CASH_AFTER_TRADE = DEMO_CASH_BEFORE_TRADE - DEMO_TRADE.quantity * DEMO_TRADE.price;

export const DEMO_RECENT_ACTIVITY = [
  { date: "2026-07-28", type: "buy" as const, symbol: "NVDA", quantity: 10, price: 196.51 },
  { date: "2026-06-15", type: "buy" as const, symbol: "bitcoin", quantity: 0.05, price: 58000.0 },
  { date: "2026-05-29", type: "buy" as const, symbol: "AAPL", quantity: 15, price: 310.0 },
];

// Weekly points, $10,000 starting balance (DEMO_TIER.startingBalance)
// trending toward the pre-trade total value above with minor realistic
// noise — the two-holding portfolio's history up to just before the
// demonstrated NVDA trade.
export const DEMO_PERFORMANCE_SERIES = [
  { date: "2026-05-29", value: 10000 },
  { date: "2026-06-05", value: 10120 },
  { date: "2026-06-12", value: 9980 },
  { date: "2026-06-19", value: 10250 },
  { date: "2026-06-26", value: 10180 },
  { date: "2026-07-03", value: 10380 },
  { date: "2026-07-10", value: 10520 },
  { date: "2026-07-17", value: 10450 },
  { date: "2026-07-24", value: 10660.2 },
];
