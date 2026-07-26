import { NextRequest, NextResponse } from "next/server";
import { getRecentInsiderActivity } from "@/lib/trackers/byTicker";

export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 25;

// Public, no auth — matches /trackers directory's own public nature. Pure
// read over already-ingested TrackerTransaction rows (see
// getRecentInsiderActivity's own comment on the double congress-safety filter).
export async function GET(request: NextRequest) {
  const limitParam = Number(request.nextUrl.searchParams.get("limit"));
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, MAX_LIMIT) : DEFAULT_LIMIT;

  const entries = await getRecentInsiderActivity(limit);
  return NextResponse.json({ entries });
}
