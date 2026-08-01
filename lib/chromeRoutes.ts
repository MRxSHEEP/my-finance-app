// Routes (and everything nested under them) that get a minimal marketing
// shell instead of the full authenticated app chrome — no TickerBar, no
// Sidebar, no AccountMenu. Single source of truth: ConditionalAppChrome
// reads this once per render to pick its branch, so the "hide TickerBar"
// decision and the "don't apply its height offset" decision can never
// drift out of sync — they're the same branch, not two separate checks.
export const MARKETING_ROUTE_PREFIXES = ["/advisors"] as const;

export function isMarketingRoute(pathname: string): boolean {
  return MARKETING_ROUTE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}
