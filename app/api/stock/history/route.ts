import { NextRequest, NextResponse } from "next/server";
import { resolveTickerSymbol } from "@/lib/resolveTicker";
import { fetchHistoryWithFallback } from "@/lib/stockHistoryCache";

const VALID_INTERVALS = [
  "1min",
  "5min",
  "15min",
  "30min",
  "1h",
  "4h",
  "1day",
] as const;
type Interval = (typeof VALID_INTERVALS)[number];

const VALID_RANGES = ["1D", "1W", "1M", "3M", "YTD", "1Y", "5Y", "MAX"] as const;
type Range = (typeof VALID_RANGES)[number];

const TRADING_DAYS_FOR_RANGE: Record<Range, number> = {
  "1D": 1,
  "1W": 5,
  "1M": 22,
  "3M": 65,
  // Unused — YTD is served as an explicit Jan 1–today date range below
  // instead, since a fixed trading-day count can't represent it accurately.
  "YTD": 0,
  "1Y": 252,
  "5Y": 1260,
  // Deliberately huge; clamped down to MAX_OUTPUTSIZE in computeOutputSize.
  "MAX": 20000,
};

const INTRADAY_MINUTES: Record<Exclude<Interval, "1day">, number> = {
  "1min": 1,
  "5min": 5,
  "15min": 15,
  "30min": 30,
  "1h": 60,
  "4h": 240,
};

const TRADING_MINUTES_PER_DAY = 390;
const MAX_OUTPUTSIZE = 5000;

function computeOutputSize(interval: Interval, range: Range): number {
  const tradingDays = TRADING_DAYS_FOR_RANGE[range];

  if (interval === "1day") {
    return Math.max(2, Math.min(MAX_OUTPUTSIZE, tradingDays));
  }

  const minutesPerCandle = INTRADAY_MINUTES[interval];
  const size = Math.ceil((tradingDays * TRADING_MINUTES_PER_DAY) / minutesPerCandle);
  return Math.min(MAX_OUTPUTSIZE, Math.max(2, size));
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("ticker")?.trim();

  if (!query) {
    return NextResponse.json(
      { error: "Missing required query parameter: ticker" },
      { status: 400 }
    );
  }

  const intervalParam = request.nextUrl.searchParams.get("interval") ?? "1day";
  const rangeParam = request.nextUrl.searchParams.get("range") ?? "1M";

  // Explicit start/end dates (used by tools like the DCA simulator that
  // need an arbitrary historical window) take priority over the preset
  // range enum below, which drives the chart's outputsize calculation.
  const startParam = request.nextUrl.searchParams.get("start");
  const endParam = request.nextUrl.searchParams.get("end");
  const explicitDateRange = Boolean(startParam && endParam);

  // YTD has no fixed trading-day count, so it's served the same way as an
  // explicit start/end request — Jan 1 of the current year through today —
  // rather than through the outputsize estimation used by the other ranges.
  const isYtd = !explicitDateRange && rangeParam === "YTD";
  const isDateRangeMode = explicitDateRange || isYtd;

  if (!VALID_INTERVALS.includes(intervalParam as Interval)) {
    return NextResponse.json(
      { error: `Invalid interval parameter. Must be one of: ${VALID_INTERVALS.join(", ")}` },
      { status: 400 }
    );
  }

  if (!isDateRangeMode && !VALID_RANGES.includes(rangeParam as Range)) {
    return NextResponse.json(
      { error: `Invalid range parameter. Must be one of: ${VALID_RANGES.join(", ")}` },
      { status: 400 }
    );
  }

  const interval = intervalParam as Interval;
  const range = rangeParam as Range;

  // Optional pagination cursor: when provided, fetch the next chunk of
  // history ending at/before this date instead of the most recent data.
  const before = request.nextUrl.searchParams.get("before");

  const apiKey = process.env.TWELVEDATA_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Server is missing TWELVEDATA_API_KEY configuration" },
      { status: 500 }
    );
  }

  const ticker = await resolveTickerSymbol(query, process.env.FINNHUB_API_KEY);

  function buildUrl(forInterval: Interval): string {
    if (isDateRangeMode) {
      let effectiveStart: string;
      let effectiveEnd: string;

      if (explicitDateRange) {
        effectiveStart = startParam as string;
        effectiveEnd = endParam as string;
      } else {
        const now = new Date();
        effectiveStart = `${now.getUTCFullYear()}-01-01`;
        effectiveEnd = now.toISOString().slice(0, 10);
      }

      return `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(
        ticker
      )}&interval=${forInterval}&start_date=${encodeURIComponent(
        effectiveStart
      )}&end_date=${encodeURIComponent(effectiveEnd)}&apikey=${apiKey}`;
    }

    const outputsize = computeOutputSize(forInterval, range);
    let url = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(
      ticker
    )}&interval=${forInterval}&outputsize=${outputsize}&apikey=${apiKey}`;

    if (before) {
      url += `&end_date=${encodeURIComponent(before)}`;
    }

    return url;
  }

  // Pagination ("load more" further back in an already-open chart) skips
  // the fallback chain below — swapping granularity mid-scroll would break
  // bar continuity with what's already rendered, and a failure here is
  // already handled gracefully client-side (it just stops infinite-scroll)
  // rather than needing a fallback chart of its own.
  if (before) {
    try {
      const result = await fetchHistoryWithFallback({
        ticker,
        range: explicitDateRange ? `custom:${startParam}:${endParam}` : range,
        primaryUrl: buildUrl(interval),
        primaryInterval: interval,
        dailyUrl: null,
      });

      if ("error" in result) {
        return NextResponse.json({ error: result.error }, { status: 502 });
      }

      return NextResponse.json({ ticker, history: result.history });
    } catch {
      return NextResponse.json({ error: "Chart data temporarily unavailable" }, { status: 502 });
    }
  }

  const dailyUrl = interval === "1day" ? null : buildUrl("1day");

  const result = await fetchHistoryWithFallback({
    ticker,
    range: explicitDateRange ? `custom:${startParam}:${endParam}` : range,
    primaryUrl: buildUrl(interval),
    primaryInterval: interval,
    dailyUrl,
  });

  if ("error" in result) {
    // Still a clean, generic message — never the raw provider error —
    // even in this "truly nothing available" case.
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  return NextResponse.json({
    ticker,
    history: result.history,
    interval: result.interval,
    stale: result.stale,
    staleFetchedAt: result.staleFetchedAt ? new Date(result.staleFetchedAt).toISOString() : null,
    fallbackApplied: result.fallbackApplied,
  });
}
