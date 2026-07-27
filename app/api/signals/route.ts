import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SIGNALS_WATCHLIST } from "@/lib/signals/watchlist";

export const dynamic = "force-dynamic";

// Serves the cron-populated cache only — never generates a signal at
// request time (see app/api/signals/ingest/route.ts for that). Returns
// every watchlist ticker, not just the ones with a cached row, so a
// ticker that hasn't generated yet (first run, or a prior failure) shows
// as an honest "not available yet" placeholder instead of just being
// absent with no explanation.
export async function GET() {
  const signals = await prisma.tradeSignal.findMany();
  const byTicker = new Map(signals.map((s) => [s.ticker, s]));

  const entries = SIGNALS_WATCHLIST.map(({ ticker, companyName }) => {
    const signal = byTicker.get(ticker);
    if (!signal) {
      return { ticker, companyName, available: false as const };
    }
    return {
      ticker,
      companyName: signal.companyName ?? companyName,
      available: true as const,
      direction: signal.direction,
      confidence: signal.confidence,
      rationale: signal.rationale,
      dataSnapshot: signal.dataSnapshot,
      generatedAt: signal.generatedAt.toISOString(),
    };
  });

  // Confidence-descending among generated signals (surfaces the
  // strongest calls first), unavailable ones pushed to the end.
  entries.sort((a, b) => {
    if (a.available && b.available) return b.confidence - a.confidence;
    if (a.available !== b.available) return a.available ? -1 : 1;
    return 0;
  });

  const lastGeneratedAt = signals.reduce<string | null>((latest, s) => {
    const iso = s.generatedAt.toISOString();
    return !latest || iso > latest ? iso : latest;
  }, null);

  return NextResponse.json({ signals: entries, lastGeneratedAt });
}
