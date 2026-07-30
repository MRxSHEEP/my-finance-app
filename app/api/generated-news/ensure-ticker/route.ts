import { NextRequest, NextResponse } from "next/server";
import { ensureArticleForTicker } from "@/lib/generatedNews/publish";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// A third trigger into the same shared Noble Generated News pool —
// alongside app/api/generated-news/ingest's fixed daily watchlist and
// .../ensure's per-user Simulated Portfolio holdings, this one covers a
// specific ticker a visitor is actively looking at right now (e.g. the
// Earnings Calendar's in-place detail view). Unlike .../ensure, this
// isn't derived from a signed-in user's own holdings and doesn't require
// auth — the pages that call it are public. Whichever of the three
// triggers reaches a given ticker first within the freshness window
// wins; the others just see a fresh row already exists and no-op, same
// as the other two.
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const ticker = typeof body?.ticker === "string" ? body.ticker.trim().toUpperCase() : "";
  const displayName = typeof body?.displayName === "string" ? body.displayName.trim() : "";

  if (!ticker) {
    return NextResponse.json({ error: "Missing required field: ticker" }, { status: 400 });
  }

  const status = await ensureArticleForTicker("stock", ticker, displayName || ticker, request.nextUrl.origin);
  return NextResponse.json({ ticker, status });
}
