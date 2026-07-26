// Isomorphic (no server-only imports) — safe to import from client
// components too, unlike lib/modelPortfolios/valuation.ts which pulls in
// lib/simulatedTrading/pricing.ts's server-side price-fetching.
export const NOTIONAL_BASE = 10000;
