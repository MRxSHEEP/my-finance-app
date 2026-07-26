import { NextRequest, NextResponse } from "next/server";
import { checkCronAuth } from "@/lib/trackers/cronAuth";
import { backfillPerformanceHistory, ingestAllThirteenF } from "@/lib/trackers/thirteenF";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const authError = checkCronAuth(request);
  if (authError) return authError;

  const results = await ingestAllThirteenF();
  // Idempotent (skips quarters already recorded) — cheap to run on every
  // poll so the performance-history chart backfills incrementally rather
  // than needing a separate cron entry of its own.
  const performance = await backfillPerformanceHistory();
  return NextResponse.json({ results, performance });
}
