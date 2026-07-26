import { NextRequest, NextResponse } from "next/server";
import { fetchEarningsCalendar } from "@/lib/earningsCalendar";

export const dynamic = "force-dynamic";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: NextRequest) {
  const fromParam = request.nextUrl.searchParams.get("from");
  const toParam = request.nextUrl.searchParams.get("to");

  // Only pass through a caller-supplied range if both dates are present
  // and well-formed — otherwise fall through to fetchEarningsCalendar's
  // own default window rather than sending a malformed request upstream.
  const useCustomRange =
    fromParam !== null && toParam !== null && ISO_DATE_RE.test(fromParam) && ISO_DATE_RE.test(toParam);

  const entries = useCustomRange
    ? await fetchEarningsCalendar(fromParam, toParam)
    : await fetchEarningsCalendar();

  return NextResponse.json({ entries, generatedAt: new Date().toISOString() });
}
