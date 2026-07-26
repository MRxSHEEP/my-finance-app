import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkCronAuth } from "@/lib/trackers/cronAuth";
import { slugify } from "@/lib/trackers/slug";

export const dynamic = "force-dynamic";

// Ensures the specific politicians and insider-company trackers named in
// the task exist as browsable pages even if they haven't happened to
// appear in FMP's rolling ~25-most-recent window yet (see
// lib/trackers/congress.ts's own comment on that constraint) — the
// scheduled ingestion job upserts real transactions onto these same
// entities (matched by slug) the moment any of them do show up. 13F funds
// need no separate seeding — lib/trackers/thirteenF.ts's own ingestion
// already creates all 7 directly from real EDGAR data.
const SEEDED_POLITICIANS = [
  { name: "Nancy Pelosi", title: "U.S. Representative (CA-11)" },
  { name: "Dan Crenshaw", title: "U.S. Representative (TX-02)" },
  { name: "Josh Gottheimer", title: "U.S. Representative (NJ-05)" },
];

const SEEDED_INSIDER_COMPANIES: Record<string, string> = {
  AAPL: "Apple Inc.",
  TSLA: "Tesla Inc.",
  NVDA: "NVIDIA Corp.",
  MSFT: "Microsoft Corp.",
  AMZN: "Amazon.com Inc.",
};

export async function POST(request: NextRequest) {
  const authError = checkCronAuth(request);
  if (authError) return authError;

  for (const politician of SEEDED_POLITICIANS) {
    const slug = slugify(politician.name);
    await prisma.trackedEntity.upsert({
      where: { slug },
      update: { title: politician.title },
      create: { slug, type: "congress", name: politician.name, title: politician.title },
    });
  }

  for (const [ticker, companyName] of Object.entries(SEEDED_INSIDER_COMPANIES)) {
    const slug = `${slugify(ticker)}-insiders`;
    await prisma.trackedEntity.upsert({
      where: { slug },
      update: {},
      create: { slug, type: "insider", name: `${companyName} Insiders`, title: `Company insider activity (${ticker})` },
    });
  }

  const count = await prisma.trackedEntity.count();
  return NextResponse.json({ ok: true, totalEntities: count });
}
