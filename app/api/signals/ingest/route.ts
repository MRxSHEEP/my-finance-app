import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/lib/generated/prisma/client";
import { checkCronAuth } from "@/lib/trackers/cronAuth";
import { prisma } from "@/lib/prisma";
import { SIGNALS_WATCHLIST } from "@/lib/signals/watchlist";
import { gatherTickerData } from "@/lib/signals/gather";
import { generateSignal } from "@/lib/signals/generate";

export const dynamic = "force-dynamic";
// This loops sequentially over ~20 tickers, each doing several external
// calls plus one Anthropic call — comfortably past the platform's default
// function timeout otherwise.
export const maxDuration = 300;

interface TickerResult {
  ticker: string;
  status: "generated" | "skipped_no_data" | "skipped_generation_failed";
}

// Sequential, not parallel — every ticker's gather step already fans out
// several external calls (TwelveData, Finnhub-backed internal routes,
// Marketaux, one Anthropic call), and running ~20 tickers' worth of those
// concurrently would burst every one of those providers at once instead
// of pacing through them one ticker at a time. Same reasoning
// lib/trackers/insiderForm4.ts already applies to its own company loop.
export async function GET(request: NextRequest) {
  const authError = checkCronAuth(request);
  if (authError) return authError;

  const origin = request.nextUrl.origin;
  const results: TickerResult[] = [];

  for (const { ticker, companyName } of SIGNALS_WATCHLIST) {
    const data = await gatherTickerData(ticker, origin);

    // Skip entirely (leaving any prior cached row untouched) rather than
    // asking Claude to generate a signal from nothing — mirrors
    // app/api/daily-briefing/route.ts's own hasAnyData guard.
    const hasAnyData =
      data.technical.latestClose !== null ||
      data.analystRating !== null ||
      data.earnings !== null ||
      data.news.length > 0 ||
      data.insiderActivity.length > 0 ||
      data.congressActivity.length > 0;

    if (!hasAnyData) {
      results.push({ ticker, status: "skipped_no_data" });
      continue;
    }

    const signal = await generateSignal(ticker, companyName, data);
    if (!signal) {
      results.push({ ticker, status: "skipped_generation_failed" });
      continue;
    }

    await prisma.tradeSignal.upsert({
      where: { ticker },
      update: {
        companyName,
        direction: signal.direction,
        confidence: signal.confidence,
        rationale: signal.rationale,
        dataSnapshot: data as unknown as Prisma.InputJsonValue,
        generatedAt: new Date(),
      },
      create: {
        ticker,
        companyName,
        direction: signal.direction,
        confidence: signal.confidence,
        rationale: signal.rationale,
        dataSnapshot: data as unknown as Prisma.InputJsonValue,
      },
    });

    results.push({ ticker, status: "generated" });
  }

  return NextResponse.json({
    tickersProcessed: results.length,
    generated: results.filter((r) => r.status === "generated").length,
    results,
  });
}
