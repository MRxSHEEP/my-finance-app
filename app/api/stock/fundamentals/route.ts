import { NextRequest, NextResponse } from "next/server";
import { resolveTickerSymbol } from "@/lib/resolveTicker";
import { fetchFmpIncomeStatement, fetchFmpProfile, fetchFmpRatios } from "@/lib/fmp";

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

  // Kicked off alongside the Finnhub request rather than after it — each
  // fetchFmp* helper already swallows its own failures (missing key, 402,
  // network error) into a plain null, so this never affects the Finnhub
  // error-handling path below.
  const fmpPromise = Promise.all([
    fetchFmpProfile(ticker),
    fetchFmpRatios(ticker),
    fetchFmpIncomeStatement(ticker, 1),
  ]);

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
  const [fmpProfile, fmpRatios, fmpIncome] = await fmpPromise;

  // FMP tends to carry more precise/current figures than Finnhub's free
  // metric=all — prefer it per-field (not all-or-nothing) so a gap in one
  // FMP field doesn't discard a good value in another.
  const fmpEps = fmpIncome?.[0]?.eps;
  const fmpPe = fmpRatios?.priceToEarningsRatio;
  // FMP reports marketCap in raw dollars; Finnhub reports it in millions —
  // normalize FMP's to the same "millions" unit before merging so the
  // shared $-to-billions formatting below works for either source.
  const fmpMarketCapMillions =
    typeof fmpProfile?.marketCap === "number" ? fmpProfile.marketCap / 1_000_000 : undefined;

  const epsValue = typeof fmpEps === "number" ? fmpEps : metric.epsBasicExclExtraItemsTTM;
  const peValue = typeof fmpPe === "number" ? fmpPe : metric.peBasicExclExtraTTM;
  const marketCapValue =
    typeof fmpMarketCapMillions === "number" ? fmpMarketCapMillions : metric.marketCapitalization;

  const eps = typeof epsValue === "number" ? `$${epsValue.toFixed(2)}` : NA;
  const peRatio = typeof peValue === "number" ? peValue.toFixed(2) : NA;
  // Values are in millions at this point regardless of source.
  const marketCap =
    typeof marketCapValue === "number"
      ? `$${(marketCapValue / 1000).toFixed(2)}B`
      : NA;

  // Already present in the same Finnhub metric=all payload fetched above —
  // no extra request needed to enrich the key-stats row with these two.
  const dividendYieldValue = metric.dividendYieldIndicatedAnnual;
  const dividendYield = typeof dividendYieldValue === "number" ? `${dividendYieldValue.toFixed(2)}%` : NA;

  const week52Low = metric["52WeekLow"];
  const week52High = metric["52WeekHigh"];
  const week52Range =
    typeof week52Low === "number" && typeof week52High === "number"
      ? `$${week52Low.toFixed(2)} – $${week52High.toFixed(2)}`
      : NA;

  return NextResponse.json({ eps, peRatio, marketCap, dividendYield, week52Range });
}
