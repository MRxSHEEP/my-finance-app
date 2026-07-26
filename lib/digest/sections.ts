// Isomorphic (no server-only imports) — the shared source of truth both
// app/page.tsx and DashboardConfigPanel import, rather than hand-maintaining
// two copies of the same section list.
export const DEFAULT_SECTION_ORDER = [
  "watchlist",
  "sectorCards",
  "news",
  "earnings",
  "movers",
  "insiderActivity",
] as const;

export type SectionKey = (typeof DEFAULT_SECTION_ORDER)[number];

export const SECTION_LABELS: Record<SectionKey, string> = {
  watchlist: "Your Watchlist",
  sectorCards: "Sector Cards",
  news: "Top Headlines",
  earnings: "Earnings This Week",
  movers: "Market Movers",
  insiderActivity: "Notable Insider Activity",
};

export function isSectionKey(value: unknown): value is SectionKey {
  return typeof value === "string" && (DEFAULT_SECTION_ORDER as readonly string[]).includes(value);
}
