import { NextRequest, NextResponse } from "next/server";
import { withCacheAndFallback } from "@/lib/newsCache";

export const dynamic = "force-dynamic";

// Bounds the worst case per request — the largest caller today is the
// Stock Catalog's one page of 20 rows (see lib/stockLogoCache.ts, which
// batches every StockLogo instance mounted within one short window into a
// single call here rather than one request per row).
const MAX_TICKERS = 50;

// Logos essentially never change — a long TTL means the same ticker is a
// real Finnhub round trip at most once a day, no matter how many rows,
// pages, or users request it in between.
const LOGO_CACHE_TTL_MS = 24 * 60 * 60_000;

interface LogoFetchResult {
  ok: boolean;
  logo: string | null;
}

// Deliberately only calls Finnhub's profile2 endpoint, not the fuller set
// app/api/stock/overview/route.ts fetches (profile2 + recommendation +
// an Anthropic-generated description) — a logo is the only thing this
// batch endpoint's one caller (StockLogo) ever needs, so the other two
// calls per ticker (one Finnhub, one Anthropic) that endpoint would have
// made are skipped entirely here. Also skips resolveTickerSymbol's own
// Finnhub /search call — every caller of this batch endpoint already
// passes canonical tickers straight from the curated stock catalog, never
// free-text company-name search input, so there's nothing to resolve.
async function fetchLogoOnly(ticker: string, apiKey: string): Promise<LogoFetchResult> {
  try {
    const response = await fetch(
      `https://finnhub.io/api/v1/stock/profile2?symbol=${encodeURIComponent(ticker)}&token=${apiKey}`
    );
    if (!response.ok) {
      console.error(`[stock-logos] ${ticker}: Finnhub request failed — status ${response.status}`);
      return { ok: false, logo: null };
    }
    const body = await response.json().catch(() => null);
    return { ok: true, logo: typeof body?.logo === "string" ? body.logo : null };
  } catch (err) {
    console.error(`[stock-logos] ${ticker}: failed to reach Finnhub — ${err instanceof Error ? err.message : String(err)}`);
    return { ok: false, logo: null };
  }
}

export async function GET(request: NextRequest) {
  const tickersParam = request.nextUrl.searchParams.get("tickers") ?? "";
  const tickers = Array.from(
    new Set(
      tickersParam
        .split(",")
        .map((t) => t.trim().toUpperCase())
        .filter(Boolean)
    )
  ).slice(0, MAX_TICKERS);

  if (tickers.length === 0) {
    return NextResponse.json(
      { error: "Missing required query parameter: tickers" },
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

  // Same cache key namespace a ticker's logo would use nowhere else — this
  // is intentionally its own cache (not shared with
  // app/api/stock/overview/route.ts's `stock-overview:${ticker}` key)
  // since the two cache genuinely different-shaped fetcher results; either
  // would populate the other's key with the wrong shape.
  const results = await Promise.all(
    tickers.map(async (ticker) => {
      const { data } = await withCacheAndFallback(
        `stock-logo:${ticker}`,
        LOGO_CACHE_TTL_MS,
        () => fetchLogoOnly(ticker, apiKey),
        (r) => r.ok
      );
      return [ticker, data.logo] as const;
    })
  );

  const logos: Record<string, string | null> = {};
  for (const [ticker, logo] of results) logos[ticker] = logo;

  return NextResponse.json({ logos });
}
