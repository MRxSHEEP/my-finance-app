type FinnhubSearchResult = {
  symbol: string;
  type?: string;
};

// Finnhub's /search doesn't index some well-known company names to their
// current ticker (e.g. it has no result at all for "Google"). Check these
// first so common cases resolve correctly without depending on search gaps.
const ALIASES: Record<string, string> = {
  GOOGLE: "GOOGL",
  FACEBOOK: "META",
  // add more as you notice gaps
};

// Resolves free-form user input (a ticker like "GOOGL" or a company name
// like "Google") to an actual ticker symbol via Finnhub's /search endpoint.
// Falls back to the raw input, uppercased, if the search fails, is
// unavailable (no API key), or finds no suitable match.
export async function resolveTickerSymbol(
  query: string,
  apiKey: string | undefined
): Promise<string> {
  const fallback = query.trim().toUpperCase();

  if (fallback in ALIASES) {
    return ALIASES[fallback];
  }

  if (!apiKey) {
    return fallback;
  }

  try {
    const url = `https://finnhub.io/api/v1/search?q=${encodeURIComponent(
      query
    )}&token=${apiKey}`;
    const response = await fetch(url);

    if (!response.ok) {
      return fallback;
    }

    const data = await response.json().catch(() => null);
    const results: FinnhubSearchResult[] = Array.isArray(data?.result)
      ? data.result
      : [];

    const match = results.find(
      (item) => item.type === "Common Stock" && !item.symbol.includes(".")
    );

    return match ? match.symbol.toUpperCase() : fallback;
  } catch {
    return fallback;
  }
}
