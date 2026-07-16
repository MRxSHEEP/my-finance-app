import { NextRequest, NextResponse } from "next/server";
import { resolveTickerSymbol } from "@/lib/resolveTicker";
import { withCache } from "@/lib/newsCache";

export const dynamic = "force-dynamic";

const CACHE_TTL_MS = 10 * 60_000;

interface PriceTargetData {
  available: boolean;
  high: number | null;
  low: number | null;
  average: number | null;
}

// Finnhub's own /stock/price-target isn't reachable on this API tier
// (confirmed live: "You don't have access to this resource"). TwelveData's
// /price_target has the right shape but, on this key, only actually
// resolves for AAPL specifically — every other symbol tested (MSFT, JNJ,
// TSLA) returns 403 "available exclusively with ultra or enterprise
// plans," which reads as a single free demo symbol rather than general
// access. So this degrades to "unavailable" for most real tickers — by
// design, not a bug — the Analyst View card still shows the existing
// star rating regardless (see components/stocks/AnalystViewCard.tsx).
export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("ticker")?.trim();
  if (!query) {
    return NextResponse.json(
      { error: "Missing required query parameter: ticker" },
      { status: 400 }
    );
  }

  const finnhubKey = process.env.FINNHUB_API_KEY;
  const twelveDataKey = process.env.TWELVEDATA_API_KEY;
  const ticker = await resolveTickerSymbol(query, finnhubKey);

  const data = await withCache(`price-target:${ticker}`, CACHE_TTL_MS, async (): Promise<PriceTargetData> => {
    const unavailable: PriceTargetData = { available: false, high: null, low: null, average: null };
    if (!twelveDataKey) return unavailable;

    const response = await fetch(
      `https://api.twelvedata.com/price_target?symbol=${encodeURIComponent(ticker)}&apikey=${twelveDataKey}`
    ).catch(() => null);
    if (!response?.ok) return unavailable;

    const body = await response.json().catch(() => null);
    if (body?.status === "error" || !body?.price_target) return unavailable;

    const { high, low, average } = body.price_target;
    if (typeof high !== "number" || typeof low !== "number" || typeof average !== "number") {
      return unavailable;
    }

    return { available: true, high, low, average };
  });

  return NextResponse.json(data);
}
