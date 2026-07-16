import { NextRequest, NextResponse } from "next/server";
import { resolveTickerSymbol } from "@/lib/resolveTicker";
import { withCache } from "@/lib/newsCache";
import { computeRatingFromTrend } from "@/lib/finnhubRating";

export const dynamic = "force-dynamic";

const CACHE_TTL_MS = 10 * 60_000;
const MAX_PEERS = 4;

interface CompanyRow {
  symbol: string;
  isCurrent: boolean;
  peRatio: number | null;
  marketCap: number | null;
  eps: number | null;
  evEbitda: number | null;
  rating: number | null;
}

interface PeersData {
  rows: CompanyRow[];
}

async function fetchCompanyRow(symbol: string, isCurrent: boolean, apiKey: string): Promise<CompanyRow> {
  const [metricResponse, recommendationResponse] = await Promise.all([
    fetch(
      `https://finnhub.io/api/v1/stock/metric?symbol=${encodeURIComponent(symbol)}&metric=all&token=${apiKey}`
    ).catch(() => null),
    fetch(
      `https://finnhub.io/api/v1/stock/recommendation?symbol=${encodeURIComponent(symbol)}&token=${apiKey}`
    ).catch(() => null),
  ]);

  const metric = metricResponse?.ok ? (await metricResponse.json().catch(() => null))?.metric : null;
  const recommendations = recommendationResponse?.ok
    ? await recommendationResponse.json().catch(() => null)
    : null;
  const latest = Array.isArray(recommendations) && recommendations.length > 0 ? recommendations[0] : null;

  return {
    symbol,
    isCurrent,
    peRatio: typeof metric?.peBasicExclExtraTTM === "number" ? metric.peBasicExclExtraTTM : null,
    // Finnhub reports this in millions of the local currency (same
    // convention already used by app/api/stock/fundamentals/route.ts).
    marketCap: typeof metric?.marketCapitalization === "number" ? metric.marketCapitalization : null,
    eps: typeof metric?.epsBasicExclExtraItemsTTM === "number" ? metric.epsBasicExclExtraItemsTTM : null,
    // Finnhub's /stock/metric already provides a precomputed evEbitdaTTM
    // directly (confirmed live) — the same ratio the EV/EBITDA tool
    // calculator derives from market cap + debt - cash, but getting it
    // as one field here avoids four extra balance-sheet calls per peer.
    evEbitda: typeof metric?.evEbitdaTTM === "number" ? metric.evEbitdaTTM : null,
    rating: computeRatingFromTrend(latest),
  };
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("ticker")?.trim();
  if (!query) {
    return NextResponse.json(
      { error: "Missing required query parameter: ticker" },
      { status: 400 }
    );
  }

  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Server is missing FINNHUB_API_KEY configuration" },
      { status: 500 }
    );
  }

  const ticker = await resolveTickerSymbol(query, apiKey);

  const data = await withCache(`peers:${ticker}`, CACHE_TTL_MS, async (): Promise<PeersData> => {
    const peersResponse = await fetch(
      `https://finnhub.io/api/v1/stock/peers?symbol=${encodeURIComponent(ticker)}&token=${apiKey}`
    ).catch(() => null);

    const peerList: string[] = peersResponse?.ok
      ? (await peersResponse.json().catch(() => null)) ?? []
      : [];

    // The peers list sometimes includes the queried symbol itself —
    // exclude it here since it gets its own row below regardless.
    const peerSymbols = peerList.filter((symbol) => symbol !== ticker).slice(0, MAX_PEERS);

    const rows = await Promise.all([
      fetchCompanyRow(ticker, true, apiKey),
      ...peerSymbols.map((symbol) => fetchCompanyRow(symbol, false, apiKey)),
    ]);

    return { rows };
  });

  return NextResponse.json(data);
}
