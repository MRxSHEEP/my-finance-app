import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { resolveTickerSymbol } from "@/lib/resolveTicker";
import { getCachedDescription, setCachedDescription } from "@/lib/descriptionCache";
import { computeRatingFromTrend, ratingToLabel } from "@/lib/finnhubRating";

const NA = "N/A";

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
  } catch {
    return NextResponse.json(
      { error: "Failed to reach Finnhub API" },
      { status: 502 }
    );
  }

  const failedResponse = !profileResponse.ok
    ? profileResponse
    : !recommendationResponse.ok
      ? recommendationResponse
      : null;

  if (failedResponse) {
    if (failedResponse.status === 401 || failedResponse.status === 403) {
      return NextResponse.json(
        { error: "Finnhub API rejected the request (invalid or unauthorized API key)" },
        { status: 502 }
      );
    }
    if (failedResponse.status === 429) {
      return NextResponse.json(
        { error: "Finnhub API rate limit exceeded" },
        { status: 502 }
      );
    }
    return NextResponse.json(
      { error: `Finnhub API error (${failedResponse.status})` },
      { status: 502 }
    );
  }

  const profile = await profileResponse.json().catch(() => null);
  const recommendations = await recommendationResponse.json().catch(() => null);

  const name: string = profile?.name || ticker;
  const industry: string = profile?.finnhubIndustry || NA;
  // profile2 doesn't return a description field at all; generate one via
  // the Anthropic API (cached locally) instead of showing a placeholder.
  const description = await generateDescription(name, ticker);

  const latest = Array.isArray(recommendations) && recommendations.length > 0
    ? recommendations[0]
    : null;

  const rating = computeRatingFromTrend(latest);
  const ratingLabel = ratingToLabel(rating);

  return NextResponse.json({
    ticker,
    name,
    industry,
    description,
    rating,
    ratingLabel,
  });
}
