import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrgRole } from "@/lib/reportingAuth";
import { computeTickerMetrics } from "@/lib/benchmarking/metrics";

export const dynamic = "force-dynamic";

const MAX_PEERS = 6;

function todayAtMidnightUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

// Shared, org-wide resource (not creator-owned) — any member with Reporting
// access can view or edit the SAME peer set, so this is plain
// requireOrgRole("advisor") throughout with no ownership check, unlike
// Reports/Model Portfolios.
export async function GET() {
  const ctx = await requireOrgRole("advisor");
  if (ctx.error) return ctx.error;

  const peerSet = await prisma.benchmarkPeerSet.findUnique({
    where: { organizationId: ctx.organizationId },
    include: { peers: true },
  });

  if (!peerSet) return NextResponse.json({ ownCompanyTicker: null, peers: [] });

  return NextResponse.json({
    ownCompanyTicker: peerSet.ownCompanyTicker,
    peers: peerSet.peers.map((p) => p.ticker),
  });
}

export async function PUT(request: NextRequest) {
  const ctx = await requireOrgRole("advisor");
  if (ctx.error) return ctx.error;

  const body = await request.json().catch(() => null);
  const ownCompanyTicker =
    typeof body?.ownCompanyTicker === "string" && body.ownCompanyTicker.trim()
      ? body.ownCompanyTicker.trim().toUpperCase()
      : null;
  const rawPeers = Array.isArray(body?.peers) ? body.peers : [];

  if (!rawPeers.every((p: unknown) => typeof p === "string")) {
    return NextResponse.json({ error: "peers must be an array of ticker strings" }, { status: 400 });
  }
  const peers: string[] = [
    ...new Set<string>(rawPeers.map((p: string) => p.trim().toUpperCase()).filter(Boolean)),
  ];
  if (peers.length > MAX_PEERS) {
    return NextResponse.json({ error: `At most ${MAX_PEERS} peer tickers are allowed` }, { status: 400 });
  }
  if (!ownCompanyTicker && peers.length === 0) {
    return NextResponse.json({ error: "Set an own-company ticker, at least one peer, or both" }, { status: 400 });
  }

  const peerSet = await prisma.benchmarkPeerSet.upsert({
    where: { organizationId: ctx.organizationId },
    create: { organizationId: ctx.organizationId, createdByUserId: ctx.userId, ownCompanyTicker },
    update: { ownCompanyTicker },
  });

  await prisma.$transaction([
    prisma.benchmarkPeer.deleteMany({ where: { benchmarkPeerSetId: peerSet.id } }),
    prisma.benchmarkPeer.createMany({ data: peers.map((ticker) => ({ benchmarkPeerSetId: peerSet.id, ticker })) }),
  ]);

  // For any ticker never snapshotted before (own company or peer, brand
  // new to this org's config), compute one snapshot immediately — mirrors
  // Model Portfolio's priceAtCreation-at-holding-creation pattern — so the
  // dashboard is never empty while waiting for tomorrow's cron.
  const allTickers = [...new Set([ownCompanyTicker, ...peers].filter((t): t is string => Boolean(t)))];
  const existing = await prisma.benchmarkMetricSnapshot.findMany({
    where: { organizationId: ctx.organizationId, ticker: { in: allTickers } },
    select: { ticker: true },
    distinct: ["ticker"],
  });
  const alreadySnapshotted = new Set(existing.map((e) => e.ticker));
  const newTickers = allTickers.filter((t) => !alreadySnapshotted.has(t));

  if (newTickers.length > 0) {
    const asOfDate = todayAtMidnightUtc();
    const metricsResults = await Promise.all(newTickers.map((ticker) => computeTickerMetrics(ticker)));
    await Promise.all(
      newTickers.map((ticker, i) => {
        const metrics = metricsResults[i];
        if (!metrics) return Promise.resolve();
        return prisma.benchmarkMetricSnapshot.upsert({
          where: { organizationId_ticker_asOfDate: { organizationId: ctx.organizationId, ticker, asOfDate } },
          create: { organizationId: ctx.organizationId, ticker, asOfDate, ...metrics },
          update: { ...metrics },
        });
      })
    );
  }

  return NextResponse.json({ ownCompanyTicker, peers });
}
