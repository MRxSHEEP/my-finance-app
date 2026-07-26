// Copied character-for-character from each tool page's own
// <DisclaimerCallout> usage (components/tools/DisclaimerCallout.tsx) — the
// PDF must carry the exact same wording a user already sees in the app,
// never a rewritten summary.
export type CalculatorType = "dcf" | "dca" | "ebitda" | "ev-ebitda" | "peg";

export const CALCULATOR_DISCLAIMERS: Record<CalculatorType, string> = {
  dcf: "This is an educational estimation tool, not investment advice. Small changes in growth or discount rate assumptions can swing the result dramatically — treat it as a way to understand the mechanics, not a precise valuation.",
  dca: "This is an educational estimation tool, not investment advice. Past performance doesn't predict future returns, and this simulation ignores taxes, fees, and dividends unless they're already reflected in the price history.",
  ebitda:
    "This is an educational estimation tool, not investment advice. EBITDA excludes real costs (interest, taxes, and eventually replacing depreciated assets), so it shouldn't be used as a substitute for net income or free cash flow when judging profitability.",
  "ev-ebitda":
    'This is an educational estimation tool, not investment advice. A "good" EV/EBITDA multiple varies a lot by industry and growth stage — always compare against similar companies, not a single fixed threshold.',
  peg: "This is an educational estimation tool, not investment advice. Growth expectations are inherently uncertain, and PEG works best comparing similar companies in the same industry and growth stage — not as an absolute cutoff.",
};
