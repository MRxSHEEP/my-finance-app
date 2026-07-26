import { NextRequest, NextResponse } from "next/server";
import { resolveTickerSymbol } from "@/lib/resolveTicker";
import { withCache } from "@/lib/newsCache";
import { fetchFmpEarnings } from "@/lib/fmp";

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

function daysBetween(isoA: string, isoB: string): number {
  return Math.abs((new Date(isoA).getTime() - new Date(isoB).getTime()) / 86_400_000);
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

    const [calendarResponse, historyResponse, fmpEarnings] = await Promise.all([
      fetch(
        `https://finnhub.io/api/v1/calendar/earnings?from=${from}&to=${toStr}&symbol=${encodeURIComponent(ticker)}&token=${apiKey}`
      ).catch(() => null),
      fetch(
        `https://finnhub.io/api/v1/stock/earnings?symbol=${encodeURIComponent(ticker)}&token=${apiKey}`
      ).catch(() => null),
      fetchFmpEarnings(ticker),
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

    // Finnhub's calendar sometimes lags a freshly-scheduled report date —
    // fall back to FMP's own upcoming (epsActual: null) entry if Finnhub
    // came back empty.
    if (!nextEarningsDate && fmpEarnings) {
      nextEarningsDate = fmpEarnings.find((entry) => entry.epsActual === null)?.date ?? null;
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
        .map((entry) => {
          // Finnhub's `period` is itself the fiscal period-end date, so it
          // can be matched against FMP's `date` for the same report —
          // within a few days' tolerance to absorb small vendor
          // discrepancies in the exact date recorded. Finnhub remains the
          // source of truth for year/quarter labeling (FMP's endpoint
          // doesn't return a fiscal quarter number, only a date, and
          // approximating one from the calendar month would mislabel any
          // company with a non-calendar fiscal year).
          const fmpMatch = fmpEarnings?.find((fe) => daysBetween(fe.date, entry.period) <= 5);
          const usedFmpActual = typeof fmpMatch?.epsActual === "number";
          const usedFmpEstimate = typeof fmpMatch?.epsEstimated === "number";
          const actual = usedFmpActual ? (fmpMatch!.epsActual as number) : entry.actual;
          const estimate = usedFmpEstimate ? (fmpMatch!.epsEstimated as number) : entry.estimate;

          // Only recompute the surprise when an FMP value actually
          // replaced a Finnhub one — otherwise keep Finnhub's own
          // reported figure unchanged.
          const surprisePercent =
            (usedFmpActual || usedFmpEstimate) &&
            typeof actual === "number" &&
            typeof estimate === "number" &&
            estimate !== 0
              ? ((actual - estimate) / Math.abs(estimate)) * 100
              : entry.surprisePercent;

          // Finnhub's own `year` is a fiscal-year label, which can
          // legitimately differ by 1 from the period-end date's calendar
          // year for a company with a non-calendar fiscal year (e.g.
          // Microsoft/Nvidia name a fiscal year for the year it ends in,
          // so a quarter ending Sept 2025 is fiscal year 2026) — but has
          // been observed coming back with an implausible value (e.g.
          // 2000) for a period that's clearly recent. A one-year fiscal
          // offset is always legitimate; a wider gap isn't a real fiscal
          // year, it's bad data, so fall back to the period's own
          // calendar year in that case rather than trusting Finnhub blindly.
          const periodCalendarYear = Number(entry.period.slice(0, 4));
          const year =
            typeof entry.year === "number" &&
            Number.isFinite(entry.year) &&
            Math.abs(entry.year - periodCalendarYear) <= 1
              ? entry.year
              : periodCalendarYear;

          return {
            period: entry.period,
            year,
            quarter: entry.quarter,
            actual,
            estimate,
            surprisePercent,
          };
        })
        .reverse(); // oldest first, so the chart reads left-to-right chronologically
    }

    return { nextEarningsDate, quarters };
  });

  return NextResponse.json(data);
}
