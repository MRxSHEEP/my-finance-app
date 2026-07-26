import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Powers the /trackers directory page — a lightweight listing (name,
// type, holding/transaction counts, latest activity) for every seeded
// entity, not the full per-entity profile (that's
// lib/trackers/profile.ts, used one entity at a time by
// /api/trackers/[slug]). Congress entities are included here (so a
// "Coming soon" section can show real seeded names even while the PDF
// ingestion pipeline stays gated off — see lib/trackers/congressPdfGate.ts)
// but their transaction/holding counts reflect only whatever the
// FMP-sourced rolling-window feed (lib/trackers/congress.ts) has
// accumulated, never the gated PDF pipeline.
export async function GET() {
  const entities = await prisma.trackedEntity.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: { select: { holdings: true, transactions: true } },
      transactions: {
        select: { reportedDate: true, disclosureDate: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  const out = entities.map((e) => ({
    slug: e.slug,
    type: e.type,
    name: e.name,
    title: e.title,
    holdingsCount: e._count.holdings,
    transactionsCount: e._count.transactions,
    latestActivity: e.transactions[0]?.disclosureDate?.toISOString() ?? e.transactions[0]?.reportedDate?.toISOString() ?? null,
  }));

  return NextResponse.json({ entities: out });
}
