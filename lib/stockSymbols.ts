import { withCache } from "@/lib/newsCache";

export interface StockSymbolEntry {
  symbol: string;
  name: string;
  exchange: string;
}

// Refreshed once a day — the exchange-listed symbol universe changes by
// at most a handful of IPOs/delistings on any given day, nowhere near
// often enough to justify a shorter TTL for a ~6,000-row reference fetch.
const CACHE_TTL_MS = 24 * 60 * 60_000;

const RELEVANT_EXCHANGES = new Set(["NYSE", "NASDAQ"]);
const RELEVANT_TYPES = new Set(["Common Stock", "American Depositary Receipt"]);

interface RawStockEntry {
  symbol: string;
  name: string;
  exchange: string;
  type: string;
}

// TwelveData's own reference-data endpoint — not the metered time_series
// endpoint the rest of this app's TwelveData calls go through (see
// lib/sparklineFetch.ts, lib/stockHistoryCache.ts), so it isn't routed
// through lib/twelveDataThrottle.ts at all. Confirmed live: it stayed on
// a normal 200 response with a full symbol list at a moment when every
// time_series call was failing with "you have run out of API credits for
// the day" — reference/metadata endpoints are a separate, effectively
// unmetered allowance on this plan.
//
// Scoped to NYSE + NASDAQ common stock and ADRs — the unfiltered list is
// ~20,000 rows across every US venue TwelveData tracks, the large
// majority (~13,000) OTC/pink-sheet tickers, warrants, rights, and units
// that aren't what a retail user typing a company name or ticker into
// search is looking for.
async function fetchFullSymbolList(): Promise<StockSymbolEntry[]> {
  const apiKey = process.env.TWELVEDATA_API_KEY;
  if (!apiKey) return [];

  try {
    const response = await fetch(`https://api.twelvedata.com/stocks?country=United States&apikey=${apiKey}`);
    const body = await response.json().catch(() => null);

    if (!response.ok || body?.status === "error" || !Array.isArray(body?.data)) {
      console.error(`[stock-symbols] fetch failed: ${JSON.stringify(body)}`);
      return [];
    }

    return (body.data as RawStockEntry[])
      .filter((entry) => RELEVANT_EXCHANGES.has(entry.exchange) && RELEVANT_TYPES.has(entry.type))
      .map((entry) => ({ symbol: entry.symbol, name: entry.name, exchange: entry.exchange }));
  } catch (err) {
    console.error(`[stock-symbols] request threw: ${err instanceof Error ? err.message : String(err)}`);
    return [];
  }
}

// The full searchable NYSE/NASDAQ common-stock-and-ADR universe (~6,100
// symbols) — deliberately kept separate from lib/stockCatalog.ts's
// STOCK_CATALOG rather than merged into it. That catalog's ~130 entries
// are the only ones with a hand-assigned sector (see CATALOG_SECTORS),
// which this reference data has no equivalent of, so it can extend
// *search* to any valid ticker but can't participate in sector browsing.
export async function fetchStockSymbolUniverse(): Promise<StockSymbolEntry[]> {
  return withCache("stock-symbol-universe", CACHE_TTL_MS, fetchFullSymbolList);
}
