import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkCronAuth } from "@/lib/trackers/cronAuth";
import { computeTickerMetrics } from "@/lib/benchmarking/metrics";

export const dynamic = "force-dynamic";

// Byte-for-byte the same shape as app/api/simulated-portfolio/snapshot/route.ts
// and app/api/model-portfolios/snapshot/route.ts — idempotent via
// BenchmarkMetricSnapshot's @@unique([organizationId, ticker, asOfDate]).
function todayAtMidnightUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export async function GET(request: NextRequest) {
  const authError = checkCronAuth(request);
  if (authError) return authError;

  const asOfDate = todayAtMidnightUtc();
  const peerSets = await prisma.benchmarkPeerSet.findMany({ include: { peers: true } });

  let snapshotsCreated = 0;

  for (const peerSet of peerSets) {
    const tickers = [
      ...(peerSet.ownCompanyTicker ? [peerSet.ownCompanyTicker] : []),
      ...peerSet.peers.map((p) => p.ticker),
    ];

    for (const ticker of tickers) {
      const existing = await prisma.benchmarkMetricSnapshot.findUnique({
        where: { organizationId_ticker_asOfDate: { organizationId: peerSet.organizationId, ticker, asOfDate } },
      });
      if (existing) continue;

      const metrics = await computeTickerMetrics(ticker);
      if (!metrics) continue;

      await prisma.benchmarkMetricSnapshot.create({
        data: { organizationId: peerSet.organizationId, ticker, asOfDate, ...metrics },
      });
      snapshotsCreated++;
    }
  }

  return NextResponse.json({ peerSetsProcessed: peerSets.length, snapshotsCreated });
}
