import { NextRequest, NextResponse } from "next/server";
import { resolveTickerSymbol } from "@/lib/resolveTicker";

const NA = "N/A";

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

  const url = `https://finnhub.io/api/v1/stock/metric?symbol=${encodeURIComponent(
    ticker
  )}&metric=all&token=${apiKey}`;

  let response: Response;
  try {
    response = await fetch(url);
  } catch {
    return NextResponse.json(
      { error: "Failed to reach Finnhub API" },
      { status: 502 }
    );
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      return NextResponse.json(
        { error: "Finnhub API rejected the request (invalid or unauthorized API key)" },
        { status: 502 }
      );
    }
    if (response.status === 429) {
      return NextResponse.json(
        { error: "Finnhub API rate limit exceeded" },
        { status: 502 }
      );
    }
    return NextResponse.json(
      { error: `Finnhub API error (${response.status})` },
      { status: 502 }
    );
  }

  const result = await response.json().catch(() => null);
  const metric = result?.metric ?? {};

  const epsValue = metric.epsBasicExclExtraItemsTTM;
  const peValue = metric.peBasicExclExtraTTM;
  const marketCapValue = metric.marketCapitalization;

  const eps = typeof epsValue === "number" ? `$${epsValue.toFixed(2)}` : NA;
  const peRatio = typeof peValue === "number" ? peValue.toFixed(2) : NA;
  // Finnhub reports marketCapitalization in millions of the local currency.
  const marketCap =
    typeof marketCapValue === "number"
      ? `$${(marketCapValue / 1000).toFixed(2)}B`
      : NA;

  return NextResponse.json({ eps, peRatio, marketCap });
}
