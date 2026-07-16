import { NextRequest, NextResponse } from "next/server";
import { resolveTickerSymbol } from "@/lib/resolveTicker";

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

  const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(
    ticker
  )}&token=${apiKey}`;

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

  const result = await response.json();

  // Finnhub returns HTTP 200 with all-zero fields for unknown symbols rather than an error status
  const hasData =
    result && (result.c !== 0 || result.h !== 0 || result.l !== 0 || result.o !== 0 || result.pc !== 0);

  if (!hasData) {
    return NextResponse.json(
      { error: `No data found for ticker "${ticker}"` },
      { status: 404 }
    );
  }

  const percentChange = ((result.c - result.o) / result.o) * 100;

  return NextResponse.json({
    ticker,
    close: result.c,
    open: result.o,
    high: result.h,
    low: result.l,
    percentChange,
  });
}
