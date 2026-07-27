import type { RawBar } from "@/lib/stockHistoryCache";
import type { TechnicalSnapshot } from "@/lib/signals/types";

// Plain average of the most recent `period` closes. `closes` is assumed
// oldest-first (fetchRecentDailyCloses's own ordering, via
// lib/stockHistoryCache.ts's .reverse() of TwelveData's newest-first
// response) — null rather than a misleading partial average when there
// isn't enough history yet.
export function computeSMA(closes: number[], period: number): number | null {
  if (closes.length < period) return null;
  const recent = closes.slice(-period);
  return recent.reduce((sum, c) => sum + c, 0) / period;
}

// Standard Wilder's-smoothing RSI. Needs at least period+1 closes (one
// extra to compute the first day-over-day change) — returns null rather
// than a number computed from too little history.
export function computeRSI(closes: number[], period = 14): number | null {
  if (closes.length < period + 1) return null;

  const changes: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    changes.push(closes[i] - closes[i - 1]);
  }

  // Seed with a simple average over the first `period` changes...
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 0; i < period; i++) {
    const change = changes[i];
    if (change > 0) avgGain += change;
    else avgLoss += -change;
  }
  avgGain /= period;
  avgLoss /= period;

  // ...then Wilder-smooth forward through the remaining changes.
  for (let i = period; i < changes.length; i++) {
    const change = changes[i];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? -change : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

// Recent (10-session) average volume vs. a longer (60-session) baseline
// that itself includes the recent window — the same "short MA vs. long
// MA" comparison convention as the price SMAs above, not a bug.
const RECENT_VOLUME_WINDOW = 10;
const BASELINE_VOLUME_WINDOW = 60;
const MIN_BARS_FOR_VOLUME_TREND = RECENT_VOLUME_WINDOW + 5;

export function computeVolumeTrend(bars: RawBar[]): number | null {
  const withVolume = bars.filter((b): b is RawBar & { volume: number } => typeof b.volume === "number");
  if (withVolume.length < MIN_BARS_FOR_VOLUME_TREND) return null;

  const recent = withVolume.slice(-RECENT_VOLUME_WINDOW);
  const baseline = withVolume.slice(-Math.min(BASELINE_VOLUME_WINDOW, withVolume.length));

  const avg = (rows: typeof withVolume) => rows.reduce((sum, b) => sum + b.volume, 0) / rows.length;
  const recentAvg = avg(recent);
  const baselineAvg = avg(baseline);
  if (baselineAvg === 0) return null;

  return ((recentAvg - baselineAvg) / baselineAvg) * 100;
}

export function computeTechnicals(bars: RawBar[]): TechnicalSnapshot {
  const closes = bars.map((b) => b.close);
  return {
    latestClose: closes.length > 0 ? closes[closes.length - 1] : null,
    sma50: computeSMA(closes, 50),
    sma200: computeSMA(closes, 200),
    rsi14: computeRSI(closes, 14),
    volumeTrendPercent: computeVolumeTrend(bars),
  };
}
