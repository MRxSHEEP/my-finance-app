import { NextRequest, NextResponse } from "next/server";
import { resolveTickerSymbol } from "@/lib/resolveTicker";
import { withCache } from "@/lib/newsCache";

export const dynamic = "force-dynamic";

// Deep Dive data changes slowly (a new earnings report, at most, once a
// quarter) — a long cache means repeat views of the same ticker within
// a session don't re-hit Finnhub at all.
const CACHE_TTL_MS = 10 * 60_000;

interface EarningsQuarter {
  period: string;
  year: number;
  quarter: number;
  actual: number | null;
  estimate: number | null;
  surprisePercent: number | null;
}

interface EarningsData {
  nextEarningsDate: string | null;
  quarters: EarningsQuarter[];
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("ticker")?.trim();
  if (!query) {
    return NextResponse.json(
      { error: "Missing required query parameter: ticker" },
      { status: 400 }
    );
  }

  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Server is missing FINNHUB_API_KEY configuration" },
      { status: 500 }
    );
  }

  const ticker = await resolveTickerSymbol(query, apiKey);

  const data = await withCache(`earnings:${ticker}`, CACHE_TTL_MS, async (): Promise<EarningsData> => {
    const today = new Date();
    const from = today.toISOString().slice(0, 10);
    const to = new Date(today);
    // ~4 months out comfortably covers the next quarterly report even
    // right after one was just posted.
    to.setUTCDate(to.getUTCDate() + 120);
    const toStr = to.toISOString().slice(0, 10);

    const [calendarResponse, historyResponse] = await Promise.all([
      fetch(
        `https://finnhub.io/api/v1/calendar/earnings?from=${from}&to=${toStr}&symbol=${encodeURIComponent(ticker)}&token=${apiKey}`
      ).catch(() => null),
      fetch(
        `https://finnhub.io/api/v1/stock/earnings?symbol=${encodeURIComponent(ticker)}&token=${apiKey}`
      ).catch(() => null),
    ]);

    let nextEarningsDate: string | null = null;
    if (calendarResponse?.ok) {
      const calendarBody = await calendarResponse.json().catch(() => null);
      const entries: Array<{ date: string; epsActual: number | null }> = Array.isArray(
        calendarBody?.earningsCalendar
      )
        ? calendarBody.earningsCalendar
        : [];
      // The calendar endpoint returns both already-reported and upcoming
      // entries within the date range — an already-reported quarter has
      // epsActual populated, so "upcoming" means epsActual is still null.
      const upcoming = entries
        .filter((entry) => entry.epsActual === null && entry.date >= from)
        .sort((a, b) => a.date.localeCompare(b.date));
      nextEarningsDate = upcoming[0]?.date ?? null;
    }

    let quarters: EarningsQuarter[] = [];
    if (historyResponse?.ok) {
      const historyBody = await historyResponse.json().catch(() => null);
      // Finnhub's free tier caps this at the last 4 reported quarters
      // regardless of a `limit` param (confirmed live) — the UI shows
      // however many actually come back rather than assuming 8.
      const raw: Array<{
        period: string;
        year: number;
        quarter: number;
        actual: number | null;
        estimate: number | null;
        surprisePercent: number | null;
      }> = Array.isArray(historyBody) ? historyBody : [];

      quarters = raw
        .map((entry) => ({
          period: entry.period,
          year: entry.year,
          quarter: entry.quarter,
          actual: entry.actual,
          estimate: entry.estimate,
          surprisePercent: entry.surprisePercent,
        }))
        .reverse(); // oldest first, so the chart reads left-to-right chronologically
    }

    return { nextEarningsDate, quarters };
  });

  return NextResponse.json(data);
}
