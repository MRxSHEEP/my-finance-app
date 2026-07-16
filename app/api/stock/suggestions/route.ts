import { NextRequest, NextResponse } from "next/server";

const MAX_RESULTS = 7;

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim();

  if (!query) {
    return NextResponse.json(
      { error: "Missing required query parameter: q" },
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

  const url = `https://finnhub.io/api/v1/search?q=${encodeURIComponent(
    query
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

  const data = await response.json().catch(() => null);
  const results: Array<{ symbol?: string; description?: string; type?: string }> =
    Array.isArray(data?.result) ? data.result : [];

  const suggestions = results
    .filter((item) => item.type === "Common Stock" && !item.symbol?.includes("."))
    .slice(0, MAX_RESULTS)
    .map((item) => ({
      symbol: item.symbol,
      description: item.description,
    }));

  return NextResponse.json({ suggestions });
}
