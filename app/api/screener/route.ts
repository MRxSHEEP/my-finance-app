import { NextResponse } from "next/server";
import { SCREENER_TICKERS } from "@/lib/screenerTickers";
import { STOCK_CATALOG } from "@/lib/stockCatalog";

export const dynamic = "force-dynamic";

// Sector labels now come from this app's own curated taxonomy (the same
// one Stock Catalog and the Earnings Calendar use) rather than Finnhub's
// raw `finnhubIndustry` string, so a sector filter here reuses the exact
// same categories/colors instead of a second, incompatible label set —
// confirmed live that 65 of the screener's 68 tickers already exist in
// STOCK_CATALOG. The remaining 3 (V, MA, PANW) are hand-assigned below
// rather than left to fall back to Finnhub's differently-shaped industry
// strings, so every screener row maps cleanly into the shared taxonomy.
const CATALOG_SECTOR_BY_SYMBOL = new Map(STOCK_CATALOG.map((entry) => [entry.symbol, entry.sector]));
const FALLBACK_SECTOR_BY_SYMBOL: Record<string, string> = {
  V: "Financials",
  MA: "Financials",
  PANW: "Technology",
};
function resolveSector(ticker: string): string {
  return CATALOG_SECTOR_BY_SYMBOL.get(ticker) ?? FALLBACK_SECTOR_BY_SYMBOL[ticker] ?? "Other";
}

// Refreshed once per hour rather than per-request — fetching live
// fundamentals for ~70 tickers on every screener visit isn't practical
// against Finnhub's free-tier rate limit (60 calls/min, confirmed
// elsewhere in this codebase — see app/api/ticker/route.ts), so this
// dataset is built once server-side and shared across every visitor
// until it goes stale.
const CACHE_TTL_MS = 60 * 60_000;

// Each ticker costs 2 Finnhub calls (profile2 + metric=all) — price is
// derived from profile2's marketCapitalization/shareOutstanding instead
// of a third /quote call. Batches are sized to stay comfortably under
// the 60/min budget with margin for retries/jitter, with a pause between
// batches for any list long enough to need more than one.
const TICKERS_PER_BATCH = 25;
const BATCH_PAUSE_MS = 61_000;

interface ScreenerRow {
  ticker: string;
  name: string;
  sector: string;
  price: number | null;
  peRatio: number | null;
  marketCap: number | null;
  dividendYield: number | null;
  // Forward P/E, revenue growth, and ROE are all genuinely available from
  // the same Finnhub metric=all call already being made (confirmed live —
  // forwardPE, revenueGrowthTTMYoy, roeTTM). ROIC itself is NOT available
  // from Finnhub's free metric set (only ROA/ROE), so this surfaces ROE
  // — honestly labeled as ROE, not presented as a substitute for ROIC.
  forwardPE: number | null;
  revenueGrowth: number | null;
  roe: number | null;
}

interface ScreenerData {
  rows: ScreenerRow[];
  updatedAt: number;
}

let cache: { data: ScreenerData; expiresAt: number } | null = null;
let inflight: Promise<ScreenerData> | null = null;

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

async function fetchRow(ticker: string, apiKey: string): Promise<ScreenerRow | null> {
  const [profileResponse, metricResponse] = await Promise.all([
    fetch(`https://finnhub.io/api/v1/stock/profile2?symbol=${encodeURIComponent(ticker)}&token=${apiKey}`).catch(
      () => null
    ),
    fetch(`https://finnhub.io/api/v1/stock/metric?symbol=${encodeURIComponent(ticker)}&metric=all&token=${apiKey}`).catch(
      () => null
    ),
  ]);

  const profile = profileResponse?.ok ? await profileResponse.json().catch(() => null) : null;
  const metric = metricResponse?.ok ? (await metricResponse.json().catch(() => null))?.metric : null;

  if (!profile || !profile.name) return null;

  const marketCap = typeof profile.marketCapitalization === "number" ? profile.marketCapitalization : null;
  const shares = typeof profile.shareOutstanding === "number" ? profile.shareOutstanding : null;
  const price = marketCap !== null && shares ? marketCap / shares : null;

  return {
    ticker,
    name: profile.name,
    sector: resolveSector(ticker),
    price,
    peRatio: typeof metric?.peBasicExclExtraTTM === "number" ? metric.peBasicExclExtraTTM : null,
    marketCap,
    dividendYield: typeof metric?.dividendYieldIndicatedAnnual === "number" ? metric.dividendYieldIndicatedAnnual : null,
    forwardPE: typeof metric?.forwardPE === "number" ? metric.forwardPE : null,
    revenueGrowth: typeof metric?.revenueGrowthTTMYoy === "number" ? metric.revenueGrowthTTMYoy : null,
    roe: typeof metric?.roeTTM === "number" ? metric.roeTTM : null,
  };
}

async function buildScreenerData(apiKey: string): Promise<ScreenerData> {
  const batches = chunk(SCREENER_TICKERS, TICKERS_PER_BATCH);
  const rows: ScreenerRow[] = [];

  for (let i = 0; i < batches.length; i++) {
    const batchStart = Date.now();
    const results = await Promise.all(batches[i].map((ticker) => fetchRow(ticker, apiKey)));
    rows.push(...results.filter((row): row is ScreenerRow => row !== null));

    const isLastBatch = i === batches.length - 1;
    if (!isLastBatch) {
      const elapsed = Date.now() - batchStart;
      const remaining = BATCH_PAUSE_MS - elapsed;
      if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining));
    }
  }

  return { rows, updatedAt: Date.now() };
}

export async function GET() {
  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Server is missing FINNHUB_API_KEY configuration" }, { status: 500 });
  }

  const now = Date.now();
  if (cache && cache.expiresAt > now) {
    return NextResponse.json(cache.data);
  }

  // A cache miss with a refresh already in flight (e.g. two visitors
  // hitting an expired cache at once) should share that one refresh
  // rather than each kicking off their own multi-minute batch fetch.
  if (!inflight) {
    inflight = buildScreenerData(apiKey).then((data) => {
      cache = { data, expiresAt: Date.now() + CACHE_TTL_MS };
      inflight = null;
      return data;
    });
  }

  const data = await inflight;
  return NextResponse.json(data);
}
