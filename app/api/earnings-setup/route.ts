import { NextRequest, NextResponse } from "next/server";
import { ensureEarningsSetupAnalysis } from "@/lib/earningsSetup/publish";

export const dynamic = "force-dynamic";
// Gather fans out several internal calls plus one Anthropic call on a
// cache miss — same reasoning as every other on-demand generation route
// in this app (e.g. app/api/generated-news/ensure/route.ts).
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const ticker = request.nextUrl.searchParams.get("ticker")?.trim().toUpperCase();
  const reportDate = request.nextUrl.searchParams.get("reportDate")?.trim();
  const companyName = request.nextUrl.searchParams.get("companyName")?.trim() || ticker;

  if (!ticker || !reportDate) {
    return NextResponse.json({ error: "Missing required query parameters: ticker, reportDate" }, { status: 400 });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(reportDate)) {
    return NextResponse.json({ error: "reportDate must be in YYYY-MM-DD format" }, { status: 400 });
  }

  const result = await ensureEarningsSetupAnalysis(ticker, companyName ?? ticker, reportDate, request.nextUrl.origin);

  return NextResponse.json(result);
}
