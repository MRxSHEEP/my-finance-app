// The canonical starting-balance tier table — the single source of truth
// for every tier's id/label/startingBalance/price, imported by both server
// routes (checkout session creation, webhook crediting) and client
// components (the tier-picker UI). Deliberately has zero server-only
// imports so it's safe to import from a "use client" component too.
export interface PortfolioTier {
  id: string;
  label: string;
  startingBalance: number;
  // 0 for the free tier — never trust a client-submitted price; routes
  // that charge money always look the amount up here by tier id.
  priceCents: number;
}

export const PORTFOLIO_TIERS: PortfolioTier[] = [
  { id: "starter", label: "Starter", startingBalance: 1_000, priceCents: 0 },
  { id: "growth", label: "Growth", startingBalance: 10_000, priceCents: 99 },
  { id: "pro", label: "Pro", startingBalance: 100_000, priceCents: 499 },
  { id: "elite", label: "Elite", startingBalance: 1_000_000, priceCents: 999 },
];

export function getTier(id: string): PortfolioTier | null {
  return PORTFOLIO_TIERS.find((t) => t.id === id) ?? null;
}
