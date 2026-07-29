import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkCronAuth } from "@/lib/trackers/cronAuth";
import { computeTickerMetrics, type TickerMetrics } from "@/lib/benchmarking/metrics";

export const dynamic = "force-dynamic";

// Byte-for-byte the same shape as app/api/simulated-portfolio/snapshot/route.ts
// and app/api/model-portfolios/snapshot/route.ts — idempotent via
// BenchmarkMetricSnapshot's @@unique([organizationId, ticker, asOfDate]).
function todayAtMidnightUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

const METRIC_FIELDS: (keyof TickerMetrics)[] = ["revenueGrowth", "grossMargin", "fcfYield", "forwardPE", "evEbitda", "roe"];

function hasNullField(snapshot: TickerMetrics): boolean {
  return METRIC_FIELDS.some((field) => snapshot[field] === null);
}

// A transient provider failure on one specific day (most likely FMP's tight
// 250-calls/day free-tier quota, shared app-wide across every consumer of
// lib/fmp.ts — insider activity, stock financials/fundamentals/earnings/
// insiders, congress trackers, and this feature all draw from the same
// quota) can leave a snapshot row's FMP-sourced fields (grossMargin,
// fcfYield) null even though its Finnhub-sourced fields succeeded in the
// same run. The original "if (existing) continue" check treated any
// existing row as permanently done, baking that day's gap in forever.
// Retrying is bounded to the last few days rather than an unbounded
// historical repair — retrying a years-old gap on every run would eat into
// the same tight quota this bound exists to protect, for a figure that
// would be stale anyway (backfilling a year-old Forward P/E with today's
// value would just be wrong, not merely late).
const RETRY_WINDOW_DAYS = 3;

// Fills in only whichever fields are actually null on `existing` — never
// overwrites a field that already holds a real value, so a fresh
// computation's slightly-different current figure (e.g. Forward P/E having
// moved since asOfDate) can never silently clobber a genuine historical
// value while patching an unrelated gap. Returns false (no write) if the
// retry still couldn't fill anything, leaving the row incomplete for the
// next run to try again while it's still within the window.
async function fillMissingFields(
  organizationId: string,
  ticker: string,
  asOfDate: Date,
  existing: TickerMetrics
): Promise<boolean> {
  const metrics = await computeTickerMetrics(ticker);
  if (!metrics) return false;

  const patch: Partial<TickerMetrics> = {};
  for (const field of METRIC_FIELDS) {
    if (existing[field] === null && metrics[field] !== null) {
      patch[field] = metrics[field] as number;
    }
  }
  if (Object.keys(patch).length === 0) return false;

  await prisma.benchmarkMetricSnapshot.update({
    where: { organizationId_ticker_asOfDate: { organizationId, ticker, asOfDate } },
    data: patch,
  });
  return true;
}

export async function GET(request: NextRequest) {
  const authError = checkCronAuth(request);
  if (authError) return authError;

  const asOfDate = todayAtMidnightUtc();
  const retryCutoff = new Date(asOfDate.getTime() - RETRY_WINDOW_DAYS * 24 * 60 * 60_000);
  const peerSets = await prisma.benchmarkPeerSet.findMany({ include: { peers: true } });

  let snapshotsCreated = 0;
  let snapshotsBackfilled = 0;

  for (const peerSet of peerSets) {
    const tickers = [
      ...(peerSet.ownCompanyTicker ? [peerSet.ownCompanyTicker] : []),
      ...peerSet.peers.map((p) => p.ticker),
    ];

    // One query per peer set for every snapshot within the retry window
    // (today included) — covers both "does today's row exist" and "which
    // past rows in the window still have gaps" without a query per ticker.
    const recentSnapshots = await prisma.benchmarkMetricSnapshot.findMany({
      where: { organizationId: peerSet.organizationId, ticker: { in: tickers }, asOfDate: { gte: retryCutoff, lte: asOfDate } },
    });

    for (const ticker of tickers) {
      const existingToday = recentSnapshots.find(
        (s) => s.ticker === ticker && s.asOfDate.getTime() === asOfDate.getTime()
      );

      if (!existingToday) {
        const metrics = await computeTickerMetrics(ticker);
        if (!metrics) continue;
        await prisma.benchmarkMetricSnapshot.create({
          data: { organizationId: peerSet.organizationId, ticker, asOfDate, ...metrics },
        });
        snapshotsCreated++;
      } else if (hasNullField(existingToday)) {
        if (await fillMissingFields(peerSet.organizationId, ticker, asOfDate, existingToday)) snapshotsBackfilled++;
      }
    }

    // Bounded backfill of incomplete PAST-day rows within the same recency
    // window — the only gaps the loop above (today-only) doesn't reach.
    const stalePastRows = recentSnapshots.filter(
      (s) => s.asOfDate.getTime() !== asOfDate.getTime() && hasNullField(s)
    );
    for (const snapshot of stalePastRows) {
      if (await fillMissingFields(peerSet.organizationId, snapshot.ticker, snapshot.asOfDate, snapshot)) {
        snapshotsBackfilled++;
      }
    }
  }

  return NextResponse.json({ peerSetsProcessed: peerSets.length, snapshotsCreated, snapshotsBackfilled });
}
