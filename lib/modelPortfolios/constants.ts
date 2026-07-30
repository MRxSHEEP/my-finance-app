// Isomorphic (no server-only imports) — safe to import from client
// components too, unlike lib/modelPortfolios/valuation.ts which pulls in
// lib/simulatedTrading/pricing.ts's server-side price-fetching.
export const NOTIONAL_BASE = 10000;

// A pure three-way even split (33.33/33.33/33.33) sums to 99.99, and
// floating-point addition pushes the actual diff from 100 to just over
// 0.01 (0.010000000000005116) — comfortably past a 0.01 tolerance despite
// being the most common three-holding allocation a person would type.
// 0.02 accepts that case (and its 100.01-typing mirror) while still
// rejecting a genuine off-by-a-percent mistake.
export const WEIGHT_SUM_EPSILON = 0.02;

// Shared by the create/edit routes and the daily snapshot cron — all three
// need to agree on exactly what "today" means (UTC midnight) so a holding's
// effectiveFrom, a ModelPortfolioSnapshot.asOfDate, and a
// ModelPortfolioHoldingSnapshot.asOfDate for the same calendar day always
// compare equal.
export function todayAtMidnightUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}
