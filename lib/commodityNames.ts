// The fixed 9-commodity universe shown on /commodities and traded against
// by the simulated-portfolio feature — shared so both stay in sync rather
// than risking two independently-maintained copies of this list. Values
// are the exact provider symbols app/api/ticker/route.ts already fetches
// (Polygon forex pairs for gold/silver, Finnhub ETF proxies for the rest —
// see that file's own comments for why).
export const COMMODITY_NAMES: Record<string, string> = {
  "C:XAUUSD": "Gold",
  "C:XAGUSD": "Silver",
  USO: "Crude Oil (WTI)",
  BNO: "Brent Crude",
  UNG: "Natural Gas",
  CPER: "Copper",
  CORN: "Corn",
  WEAT: "Wheat",
  SOYB: "Soybeans",
};
