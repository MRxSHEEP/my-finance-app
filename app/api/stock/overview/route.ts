import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { resolveTickerSymbol } from "@/lib/resolveTicker";
import { getCachedDescription, setCachedDescription } from "@/lib/descriptionCache";
import { computeRatingFromTrend, ratingToLabel } from "@/lib/finnhubRating";
import { withCacheAndFallback } from "@/lib/newsCache";

const NA = "N/A";

// This route previously had no caching at all — every request (including
// the 20+ fired near-simultaneously by StockLogo instances on a single
// Stock Catalog page load, one per row, each for a different ticker) hit
// Finnhub live for BOTH profile2 and recommendation, on top of
// resolveTickerSymbol's own /search call. A ticker nobody had ever
// requested before this process started had nothing to fall back to, so
// a single transient Finnhub rate-limit (easy to trigger given the above)
// surfaced as a raw 502/404 with no graceful degradation — confirmed live
// as the root cause of the Earnings Calendar -> stock page cross-link
// breaking for less-common tickers (AVB, EQR) while major tickers
// (already warm in the stale cache from constant traffic) kept working.
// Company profile/industry/logo/exchange/currency change rarely and the
// analyst recommendation trend updates roughly monthly, so an hour-long
// cache is safe and, combined with the stale-on-failure fallback below,
// means the same ticker is only ever a real Finnhub round trip once an
// hour regardless of how many rows/users request it.
const OVERVIEW_CACHE_TTL_MS = 60 * 60_000;

async function generateDescription(
  name: string,
  ticker: string
): Promise<string | undefined> {
  const cached = getCachedDescription(ticker);
  if (cached) return cached;

  if (!process.env.ANTHROPIC_API_KEY) return undefined;

  try {
    const anthropic = new Anthropic();
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 100,
      messages: [
        {
          role: "user",
          content: `In exactly one concise sentence, describe what ${name} (${ticker}) does as a business. No preamble, just the sentence.`,
        },
      ],
    });

    const textBlock = message.content.find((block) => block.type === "text");
    const generated = textBlock?.type === "text" ? textBlock.text.trim() : "";

    if (!generated) return undefined;

    setCachedDescription(ticker, generated);
    return generated;
  } catch {
    // Description generation is supplementary — omit it rather than
    // breaking the whole overview response.
    return undefined;
  }
}

interface OverviewData {
  ticker: string;
  name: string;
  industry: string;
  description?: string;
  rating: ReturnType<typeof computeRatingFromTrend>;
  ratingLabel: string;
  recommendationBreakdown: {
    period: string | null;
    strongBuy: number;
    buy: number;
    hold: number;
    sell: number;
    strongSell: number;
  } | null;
  previousRating: ReturnType<typeof computeRatingFromTrend>;
  previousPeriod: string | null;
  logo: string | null;
  exchange: string | null;
  weburl: string | null;
  currency: string | null;
  sharesOutstandingMillions: number | null;
}

interface OverviewFetchResult {
  ok: boolean;
  data: OverviewData | null;
}

// Never throws — any failure (network, non-2xx, malformed body) resolves
// to `{ ok: false, data: null }` instead, so withCacheAndFallback below
// can tell a genuine failure apart from a successful response and fall
// back to the last known-good overview for this ticker rather than
// propagating a raw error.
async function fetchOverviewData(ticker: string, apiKey: string): Promise<OverviewFetchResult> {
  const profileUrl = `https://finnhub.io/api/v1/stock/profile2?symbol=${encodeURIComponent(
    ticker
  )}&token=${apiKey}`;
  // Finnhub's documented "recommendation-trends" path 302-redirects to a
  // 404 on this key; the endpoint that actually serves this data is
  // "recommendation" (verified live), with an identical response shape.
  const recommendationUrl = `https://finnhub.io/api/v1/stock/recommendation?symbol=${encodeURIComponent(
    ticker
  )}&token=${apiKey}`;

  let profileResponse: Response;
  let recommendationResponse: Response;
  try {
    [profileResponse, recommendationResponse] = await Promise.all([
      fetch(profileUrl),
      fetch(recommendationUrl),
    ]);
  } catch (err) {
    console.error(`[stock-overview] ${ticker}: failed to reach Finnhub — ${err instanceof Error ? err.message : String(err)}`);
    return { ok: false, data: null };
  }

  const failedResponse = !profileResponse.ok
    ? profileResponse
    : !recommendationResponse.ok
      ? recommendationResponse
      : null;

  if (failedResponse) {
    console.error(`[stock-overview] ${ticker}: Finnhub request failed — status ${failedResponse.status}`);
    return { ok: false, data: null };
  }

  const profile = await profileResponse.json().catch(() => null);
  const recommendations = await recommendationResponse.json().catch(() => null);

  const name: string = profile?.name || ticker;
  const industry: string = profile?.finnhubIndustry || NA;
  const logo: string | null = profile?.logo || null;
  const exchange: string | null = profile?.exchange || null;
  const weburl: string | null = profile?.weburl || null;
  const currency: string | null = profile?.currency || null;
  // Finnhub reports this in millions of shares — used by the DCF
  // Calculator's cross-link (see app/tools/dcf/page.tsx) to convert a
  // fetched intrinsic value total into a real per-share pre-fill.
  const sharesOutstandingMillions: number | null =
    typeof profile?.shareOutstanding === "number" ? profile.shareOutstanding : null;
  // profile2 doesn't return a description field at all; generate one via
  // the Anthropic API (cached locally) instead of showing a placeholder.
  const description = await generateDescription(name, ticker);

  const recommendationList: Array<{
    period?: string;
    strongBuy?: number;
    buy?: number;
    hold?: number;
    sell?: number;
    strongSell?: number;
  }> = Array.isArray(recommendations) ? recommendations : [];

  // Finnhub returns these newest-first (confirmed live) — [0] is the
  // latest month, [1] the month before it.
  const latest = recommendationList[0] ?? null;
  const previous = recommendationList[1] ?? null;

  const rating = computeRatingFromTrend(latest);
  const ratingLabel = ratingToLabel(rating);
  const previousRating = computeRatingFromTrend(previous);

  // The raw Buy/Hold/Sell counts behind `rating`'s single weighted number —
  // previously computed then discarded; surfaced now so the stock page's
  // Analyst View can show a real breakdown, not just one blended score.
  const recommendationBreakdown =
    latest && (latest.strongBuy || latest.buy || latest.hold || latest.sell || latest.strongSell)
      ? {
          period: latest.period ?? null,
          strongBuy: latest.strongBuy ?? 0,
          buy: latest.buy ?? 0,
          hold: latest.hold ?? 0,
          sell: latest.sell ?? 0,
          strongSell: latest.strongSell ?? 0,
        }
      : null;

  return {
    ok: true,
    data: {
      ticker,
      name,
      industry,
      description,
      rating,
      ratingLabel,
      recommendationBreakdown,
      previousRating,
      previousPeriod: previous?.period ?? null,
      logo,
      exchange,
      weburl,
      currency,
      sharesOutstandingMillions,
    },
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

  const { data: result, stale, staleFetchedAt } = await withCacheAndFallback(
    `stock-overview:${ticker}`,
    OVERVIEW_CACHE_TTL_MS,
    () => fetchOverviewData(ticker, apiKey),
    (r) => r.ok
  );

  if (!result.ok || !result.data) {
    return NextResponse.json(
      { error: `No data found for ticker "${ticker}" (Finnhub may be rate-limited and no prior overview is cached yet)` },
      { status: 502 }
    );
  }

  return NextResponse.json({ ...result.data, stale, staleFetchedAt });
}
