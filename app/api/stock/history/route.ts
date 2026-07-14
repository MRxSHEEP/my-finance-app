import { NextRequest, NextResponse } from "next/server";

const UNAVAILABLE_MESSAGE = "Historical data unavailable on this plan";

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

const VALID_RANGES = ["1D", "1W", "1M", "3M", "1Y"] as const;
type Range = (typeof VALID_RANGES)[number];

const TRADING_DAYS_FOR_RANGE: Record<Range, number> = {
  "1D": 1,
  "1W": 5,
  "1M": 22,
  "3M": 65,
  "1Y": 252,
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
    return Math.max(2, tradingDays);
  }

  const minutesPerCandle = INTRADAY_MINUTES[interval];
  const size = Math.ceil((tradingDays * TRADING_MINUTES_PER_DAY) / minutesPerCandle);
  return Math.min(MAX_OUTPUTSIZE, Math.max(2, size));
}

export async function GET(request: NextRequest) {
  const ticker = request.nextUrl.searchParams.get("ticker")?.trim().toUpperCase();

  if (!ticker) {
    return NextResponse.json(
      { error: "Missing required query parameter: ticker" },
      { status: 400 }
    );
  }

  const intervalParam = request.nextUrl.searchParams.get("interval") ?? "1day";
  const rangeParam = request.nextUrl.searchParams.get("range") ?? "1M";

  if (!VALID_INTERVALS.includes(intervalParam as Interval)) {
    return NextResponse.json(
      { error: `Invalid interval parameter. Must be one of: ${VALID_INTERVALS.join(", ")}` },
      { status: 400 }
    );
  }

  if (!VALID_RANGES.includes(rangeParam as Range)) {
    return NextResponse.json(
      { error: `Invalid range parameter. Must be one of: ${VALID_RANGES.join(", ")}` },
      { status: 400 }
    );
  }

  const interval = intervalParam as Interval;
  const range = rangeParam as Range;

  const apiKey = process.env.TWELVEDATA_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Server is missing TWELVEDATA_API_KEY configuration" },
      { status: 500 }
    );
  }

  const outputsize = computeOutputSize(interval, range);

  const url = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(
    ticker
  )}&interval=${interval}&outputsize=${outputsize}&apikey=${apiKey}`;

  let response: Response;
  try {
    response = await fetch(url);
  } catch {
    return NextResponse.json(
      { error: "Failed to reach Twelve Data API" },
      { status: 502 }
    );
  }

  // Twelve Data signals failures (invalid symbol, plan restrictions, bad key)
  // via a "status": "error" JSON body, often alongside a non-2xx HTTP status.
  const result = await response.json().catch(() => null);

  if (result?.status === "error") {
    if (response.status === 401 || response.status === 403) {
      return NextResponse.json({ error: UNAVAILABLE_MESSAGE }, { status: 403 });
    }
    return NextResponse.json(
      { error: result.message ?? UNAVAILABLE_MESSAGE },
      { status: 502 }
    );
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      return NextResponse.json({ error: UNAVAILABLE_MESSAGE }, { status: 403 });
    }
    if (response.status === 429) {
      return NextResponse.json(
        { error: "Twelve Data API rate limit exceeded" },
        { status: 502 }
      );
    }
    return NextResponse.json(
      { error: `Twelve Data API error (${response.status})` },
      { status: 502 }
    );
  }

  if (!Array.isArray(result.values) || result.values.length === 0) {
    return NextResponse.json(
      { error: `No data found for ticker "${ticker}"` },
      { status: 404 }
    );
  }

  const history = result.values
    .map(
      (value: {
        datetime: string;
        open: string;
        high: string;
        low: string;
        close: string;
        volume?: string;
      }) => ({
        date: value.datetime,
        open: Number(value.open),
        high: Number(value.high),
        low: Number(value.low),
        close: Number(value.close),
        volume: value.volume !== undefined ? Number(value.volume) : undefined,
      })
    )
    .reverse();

  return NextResponse.json({ ticker, history });
}
