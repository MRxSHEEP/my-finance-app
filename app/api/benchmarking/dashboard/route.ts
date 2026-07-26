import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrgRole } from "@/lib/reportingAuth";

export const dynamic = "force-dynamic";

// Pure DB read — no live provider calls. These 6 metrics are fundamentals
// that update quarterly/annually at most (unlike Simulated/Model
// Portfolio's real-time price data), so "current" is simply the latest
// already-stored BenchmarkMetricSnapshot row, not a fresh fetch on every
// view. Live computation happens only in peer-set/route.ts (on first add)
// and snapshot/route.ts (the daily cron).
export async function GET() {
  const ctx = await requireOrgRole("advisor");
  if (ctx.error) return ctx.error;

  const peerSet = await prisma.benchmarkPeerSet.findUnique({
    where: { organizationId: ctx.organizationId },
    include: { peers: true },
  });

  if (!peerSet) return NextResponse.json({ tickers: [] });

  const tickerList = [
    ...(peerSet.ownCompanyTicker ? [{ ticker: peerSet.ownCompanyTicker, isOwnCompany: true }] : []),
    ...peerSet.peers.map((p) => ({ ticker: p.ticker, isOwnCompany: false })),
  ];

  const allSnapshots = await prisma.benchmarkMetricSnapshot.findMany({
    where: { organizationId: ctx.organizationId, ticker: { in: tickerList.map((t) => t.ticker) } },
    orderBy: { asOfDate: "asc" },
  });

  const snapshotsByTicker = new Map<string, typeof allSnapshots>();
  for (const snap of allSnapshots) {
    const list = snapshotsByTicker.get(snap.ticker) ?? [];
    list.push(snap);
    snapshotsByTicker.set(snap.ticker, list);
  }

  const tickers = tickerList.map(({ ticker, isOwnCompany }) => {
    const series = snapshotsByTicker.get(ticker) ?? [];
    const latestSnap = series[series.length - 1] ?? null;

    return {
      ticker,
      isOwnCompany,
      latest: latestSnap
        ? {
            revenueGrowth: latestSnap.revenueGrowth,
            grossMargin: latestSnap.grossMargin,
            fcfYield: latestSnap.fcfYield,
            forwardPE: latestSnap.forwardPE,
            evEbitda: latestSnap.evEbitda,
            roe: latestSnap.roe,
          }
        : null,
      series: series.map((s) => ({
        asOfDate: s.asOfDate.toISOString(),
        revenueGrowth: s.revenueGrowth,
        grossMargin: s.grossMargin,
        fcfYield: s.fcfYield,
        forwardPE: s.forwardPE,
        evEbitda: s.evEbitda,
        roe: s.roe,
      })),
    };
  });

  return NextResponse.json({ tickers });
}
