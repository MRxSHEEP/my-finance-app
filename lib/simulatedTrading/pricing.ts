import { fetchFinnhubQuote } from "@/lib/finnhubQuoteCache";
import { COMMODITY_NAMES } from "@/lib/commodityNames";

export interface PriceResult {
  price: number;
}

// Stocks reuse the existing, already stale-fallback-safe Finnhub quote
// cache as-is (per explicit instruction) — its ~45s freshness is treated
// as "current" the same way the rest of the Stocks page already does.
async function getStockPrice(symbol: string): Promise<PriceResult | null> {
  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) return null;

  const { quote } = await fetchFinnhubQuote(symbol, apiKey);
  return quote ? { price: quote.price } : null;
}

// Commodities and crypto deliberately do NOT reuse this app's existing
// display caches (20-60s for commodities via app/api/ticker/route.ts, up
// to 3 minutes for crypto rankings) — a trade-execution price should be as
// fresh as reasonably possible, and if a fresh fetch fails there is
// nothing stale to fall back to here: the trade is simply rejected
// ("price unavailable, try again") rather than executed against a
// possibly-stale number. This mirrors the same provider/symbol mapping
// app/api/ticker/route.ts already uses (Polygon for gold/silver forex
// pairs, Finnhub for the ETF-proxy symbols) rather than duplicating a
// third copy of that logic — see lib/commodityNames.ts for the shared
// symbol list both files trade against.
const COMMODITY_PROVIDER: Record<string, "polygon" | "finnhub"> = {
  "C:XAUUSD": "polygon",
  "C:XAGUSD": "polygon",
};

async function fetchFinnhubSpot(symbol: string, apiKey: string): Promise<number | null> {
  try {
    const response = await fetch(`https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${apiKey}`);
    if (!response.ok) return null;
    const data = await response.json().catch(() => null);
    const hasData = data && (data.c !== 0 || data.h !== 0 || data.l !== 0 || data.o !== 0 || data.pc !== 0);
    return hasData ? data.c : null;
  } catch {
    return null;
  }
}

async function fetchPolygonSpot(symbol: string, apiKey: string): Promise<number | null> {
  try {
    // Polygon's free tier has no real-time last-quote access for forex
    // pairs (confirmed live elsewhere in this app — see
    // app/api/ticker/route.ts's own fetchPolygonQuote), so the most recent
    // daily bar's close stands in for "current price," same as that route.
    const to = new Date();
    const from = new Date(to);
    from.setUTCDate(from.getUTCDate() - 10);
    const fromStr = from.toISOString().slice(0, 10);
    const toStr = to.toISOString().slice(0, 10);

    const response = await fetch(
      `https://api.polygon.io/v2/aggs/ticker/${encodeURIComponent(symbol)}/range/1/day/${fromStr}/${toStr}?adjusted=true&sort=desc&limit=1&apiKey=${apiKey}`
    );
    if (!response.ok) return null;
    const data = await response.json().catch(() => null);
    const bars: Array<{ c: number }> = Array.isArray(data?.results) ? data.results : [];
    return bars[0]?.c ?? null;
  } catch {
    return null;
  }
}

async function getCommodityPrice(symbol: string): Promise<PriceResult | null> {
  if (!(symbol in COMMODITY_NAMES)) return null;

  const provider = COMMODITY_PROVIDER[symbol] ?? "finnhub";
  if (provider === "polygon") {
    const apiKey = process.env.POLYGON_API_KEY;
    if (!apiKey) return null;
    const price = await fetchPolygonSpot(symbol, apiKey);
    return price != null ? { price } : null;
  }

  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) return null;
  const price = await fetchFinnhubSpot(symbol, apiKey);
  return price != null ? { price } : null;
}

// A purpose-built, minimal CoinGecko call rather than reusing the heavier
// /coins/markets-backed rankings/detail routes (which also carry a much
// longer cache) — this is the smallest CoinGecko endpoint that answers
// exactly "what is this one coin worth in USD right now."
async function getCryptoPrice(id: string): Promise<PriceResult | null> {
  try {
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(id)}&vs_currencies=usd`
    );
    if (!response.ok) return null;
    const data = await response.json().catch(() => null);
    const price = data?.[id]?.usd;
    return typeof price === "number" ? { price } : null;
  } catch {
    return null;
  }
}

export type AssetType = "stock" | "commodity" | "crypto";

export async function getCurrentPrice(assetType: AssetType, symbol: string): Promise<PriceResult | null> {
  if (assetType === "stock") return getStockPrice(symbol);
  if (assetType === "commodity") return getCommodityPrice(symbol);
  if (assetType === "crypto") return getCryptoPrice(symbol);
  return null;
}
