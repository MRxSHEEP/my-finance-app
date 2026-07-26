import { STOCK_CATALOG } from "@/lib/stockCatalog";
import { fetchStockSymbolUniverse } from "@/lib/stockSymbols";

// 13F filings identify holdings by issuer name + CUSIP, never a ticker —
// CUSIP-to-ticker mapping data itself is licensed (ANNA/CUSIP Global
// Services) and can't be freely redistributed, so this resolves by
// normalized issuer NAME against this app's own known-symbol universe
// instead (lib/stockCatalog.ts's curated ~130 plus lib/stockSymbols.ts's
// full ~6,100 NYSE/NASDAQ common-stock-and-ADR list). This covers the
// vast majority of large/mid-cap names big funds actually hold. Anything
// that doesn't match is stored with `ticker: null` and the raw issuer
// name kept — never guessed at.
function normalizeIssuerName(name: string): string {
  return name
    .toUpperCase()
    .replace(/[.,'-]/g, " ") // "Coca-Cola" vs SEC's "COCA COLA" — punctuation differences shouldn't break a match
    .replace(/\b(INC|CORP|CORPORATION|COMPANY|CO|LTD|LLC|PLC|LP|THE|HOLDINGS?|GROUP|CLASS [A-Z]|COM(MON)?( STOCK)?)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// SEC 13F issuer names are the filer's own free-text entry, not a
// controlled vocabulary — confirmed live against Berkshire Hathaway's own
// filing, several of its real, large holdings use an abbreviated/legacy
// name that a straight word-strip normalization still won't match (e.g.
// "PETE" for "Petroleum", or a legal name genuinely missing a word like
// "of"). A small alias table for the specific real cases observed, rather
// than a generic fuzzy-match algorithm — anything not covered here still
// correctly falls through to `ticker: null` + the raw name kept, never
// guessed at.
const NORMALIZED_ALIASES: Record<string, string> = {
  "BANK AMERICA CORP": "BAC",
  "OCCIDENTAL PETE CORP": "OXY",
  "MOODYS CORP": "MCO",
  "CHUBB LTD SWITZ": "CB",
  "SIRIUSXM HOLDINGS INC": "SIRI",
};

let cachedIndex: Map<string, string> | null = null;

async function buildIndex(): Promise<Map<string, string>> {
  if (cachedIndex) return cachedIndex;

  const index = new Map<string, string>();
  for (const entry of STOCK_CATALOG) {
    index.set(normalizeIssuerName(entry.name), entry.symbol);
  }

  const universe = await fetchStockSymbolUniverse();
  for (const entry of universe) {
    const key = normalizeIssuerName(entry.name);
    if (!index.has(key)) index.set(key, entry.symbol);
  }

  cachedIndex = index;
  return index;
}

export async function resolveIssuerToTicker(issuerName: string): Promise<string | null> {
  if (issuerName.toUpperCase() in NORMALIZED_ALIASES) {
    return NORMALIZED_ALIASES[issuerName.toUpperCase()];
  }

  const index = await buildIndex();
  return index.get(normalizeIssuerName(issuerName)) ?? null;
}
