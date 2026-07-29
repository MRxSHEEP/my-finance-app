import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth-helpers";
import { ensureArticleForTicker, type EnsureArticleResult } from "@/lib/generatedNews/publish";
import type { GeneratedNewsAssetType } from "@/lib/generatedNews/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Same top-N-by-value cap lib/reportNarrative/gather.ts applies to its own
// per-holding gather loop, for the same reason: this runs on a real user's
// page view, so latency/cost needs to stay bounded even for a large
// portfolio.
const MAX_HOLDINGS = 8;

// A hard ceiling on total time spent generating, not per-ticker — most
// iterations are just a cheap "already fresh" DB check (the steady-state
// case), so only genuinely stale/missing tickers pay the full
// gather+generate+fact-check cost. If a batch of holdings all happen to be
// stale at once (e.g. a portfolio's very first view), this stops partway
// through rather than risk exceeding maxDuration — whatever's left over
// just gets picked up by the next page view's call to this same route.
const TIME_BUDGET_MS = 45_000;

interface HeldTicker {
  assetType: GeneratedNewsAssetType;
  ticker: string;
  displayName: string;
  bookValue: number;
}

async function getTopHeldTickers(userId: string): Promise<HeldTicker[]> {
  const holdings = await prisma.simulatedHolding.findMany({
    where: { portfolio: { userId } },
    select: { assetType: true, symbol: true, name: true, quantity: true, averageCostBasis: true },
  });

  const byKey = new Map<string, HeldTicker>();
  for (const h of holdings) {
    if (h.assetType !== "stock" && h.assetType !== "crypto" && h.assetType !== "commodity") continue;
    const key = `${h.assetType}:${h.symbol}`;
    const bookValue = h.quantity * h.averageCostBasis;
    const existing = byKey.get(key);
    if (existing) {
      existing.bookValue += bookValue;
    } else {
      byKey.set(key, { assetType: h.assetType, ticker: h.symbol, displayName: h.name ?? h.symbol, bookValue });
    }
  }

  return [...byKey.values()].sort((a, b) => b.bookValue - a.bookValue).slice(0, MAX_HOLDINGS);
}

interface ItemResult {
  assetType: GeneratedNewsAssetType;
  ticker: string;
  status: EnsureArticleResult | "skipped_time_budget";
}

// Called fire-and-forget from the client (see app/news/page.tsx) whenever
// a signed-in user with an active Simulated Portfolio views the News feed
// — the client does not await this before rendering, so a live Claude
// generation never blocks page load. The route itself still fully
// processes (awaits) its work rather than detaching a background task,
// since a serverless function's execution isn't guaranteed to continue
// once its response is sent.
export async function POST(request: NextRequest) {
  const auth = await requireUserId();
  if (auth.error) return auth.error;

  const heldTickers = await getTopHeldTickers(auth.userId);
  const origin = request.nextUrl.origin;
  const startedAt = Date.now();
  const results: ItemResult[] = [];

  for (const held of heldTickers) {
    if (Date.now() - startedAt > TIME_BUDGET_MS) {
      results.push({ assetType: held.assetType, ticker: held.ticker, status: "skipped_time_budget" });
      continue;
    }
    const status = await ensureArticleForTicker(held.assetType, held.ticker, held.displayName, origin);
    results.push({ assetType: held.assetType, ticker: held.ticker, status });
  }

  return NextResponse.json({
    tickersConsidered: results.length,
    published: results.filter((r) => r.status === "published").length,
    results,
  });
}
