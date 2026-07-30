type FinnhubSearchResult = {
  symbol: string;
  description?: string;
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

// Confirms the raw input is already a real, tradable ticker by checking
// Finnhub's own /quote endpoint directly — independent of /search, which
// (confirmed live) doesn't reliably index every real ticker under a bare
// query at all: searching "SQ" never returns Block, Inc.'s own "SQ"
// listing in its results, only unrelated fuzzy text matches like
// Bristol-Myers Squibb. Re-ranking /search's results can't recover an
// answer /search never returned in the first place, so this checks the
// input itself before ever trusting a fuzzy fallback.
export async function isValidTicker(symbol: string, apiKey: string): Promise<boolean> {
  try {
    const response = await fetch(`https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${apiKey}`);
    if (!response.ok) return false;
    const data = await response.json().catch(() => null);
    // Finnhub returns HTTP 200 with all-zero fields for unknown symbols
    // rather than an error status — same "has real data" check
    // lib/finnhubQuoteCache.ts already uses for exactly this reason.
    return Boolean(data && (data.c !== 0 || data.h !== 0 || data.l !== 0 || data.o !== 0 || data.pc !== 0));
  } catch {
    return false;
  }
}

// Server-side enforcement gate for every route that accepts a ticker via
// TickerAutocompleteInput.tsx (Peer Benchmarking's peer-set, Preclearance,
// Restricted List, Trade Disclosures) — the suggestions dropdown in that
// component is a convenience, not a guarantee, since its onChange fires on
// every keystroke whether or not a suggestion was ever selected. This is
// the actual trust boundary: call it before persisting any user-submitted
// ticker string, and reject the request if it comes back invalid, rather
// than silently storing free text (that bug — "GOOGLE" persisted as-is,
// resolving to no real data — is exactly what let a restricted-list check
// silently miss a real match).
//
// Fails OPEN only when FINNHUB_API_KEY itself isn't configured (mirrors
// resolveTickerSymbol's own fallback below, for the same reason: a missing
// key means this environment has no way to check at all, not that a
// specific input looked suspicious) — a genuine "not a real ticker" result,
// or a transient Finnhub outage, both fail CLOSED via isValidTicker's own
// catch-returns-false behavior above.
export async function validateRealTicker(ticker: string): Promise<{ valid: true } | { valid: false; error: string }> {
  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) return { valid: true };

  const ok = await isValidTicker(ticker, apiKey);
  return ok ? { valid: true } : { valid: false, error: `"${ticker}" is not a recognized ticker symbol` };
}

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

    const data = response.ok ? await response.json().catch(() => null) : null;
    const results: FinnhubSearchResult[] = Array.isArray(data?.result) ? data.result : [];

    const commonStocks = results.filter(
      (item) => item.type === "Common Stock" && !item.symbol.includes(".")
    );

    // An exact ticker-symbol match always wins over Finnhub's own relevance
    // ranking, when /search happens to return one at all — confirmed live
    // that querying "SQ" ranked Bristol-Myers Squibb's "BMY" first among
    // Common Stock results, so blindly taking the top hit silently resolved
    // a real ticker query to a completely unrelated company.
    const exactMatch = commonStocks.find((item) => item.symbol.toUpperCase() === fallback);
    if (exactMatch) return exactMatch.symbol.toUpperCase();

    // /search returned no exact match at all (Block/Square's own "SQ"
    // listing never appears in its results for that query — its ticker
    // actually changed to "XYZ" some time ago, so "SQ" is a genuinely
    // retired symbol now, not just a search-indexing gap) — before
    // trusting whatever fuzzy top result it did return, confirm directly
    // whether the raw input is itself already a real, currently-quoted
    // ticker. Only one extra call, and only in this specific gap case, not
    // on every resolution.
    if (await isValidTicker(fallback, apiKey)) return fallback;

    // Still nothing — only trust a fuzzy result if it's a genuine
    // company-NAME match (its description starts with the query), not
    // just Finnhub's own internal relevance scoring, which can surface a
    // completely unrelated company purely because the query happens to
    // appear mid-word somewhere in its name. Confirmed live: querying "SQ"
    // ranks Bristol-Myers Squibb first among Common Stock results — not
    // because it's related to the query, but because "Squibb" contains
    // "sq". A genuine name search (e.g. "Tesla") always has the company's
    // own name starting with what was typed; this coincidence doesn't.
    const nameMatch = commonStocks.find((item) => item.description?.toUpperCase().startsWith(fallback));
    if (nameMatch) return nameMatch.symbol.toUpperCase();

    return fallback;
  } catch {
    return fallback;
  }
}
