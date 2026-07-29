"use client";

import { useEffect, useMemo, useState } from "react";
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { TrendingUp } from "lucide-react";
import { cardClass } from "@/lib/cardStyles";
import AnimatedNumber from "@/components/tools/AnimatedNumber";

// Below this many real data points, the chart is technically renderable
// but too sparse to look intentional (a near-flat 2-3 point line) — still
// shown (never hidden — it's real data), just with a small caption below
// explaining why, rather than looking like a rendering glitch.
const SPARSE_HISTORY_POINT_COUNT = 5;

type Timeframe = "1D" | "1W" | "1M" | "3M" | "1Y" | "ALL";

const TIMEFRAMES: Timeframe[] = ["1D", "1W", "1M", "3M", "1Y", "ALL"];

const DAY_MS = 86_400_000;

// "1D"/"ALL" are always selectable — a short/no-op window on a brand new
// portfolio is still a valid (if sparse) view, not a misleading one.
// Everything else requires the portfolio to actually be at least that old,
// so e.g. a 2-day-old portfolio can't show a "1Y" button implying a full
// year of real history it doesn't have — matches the exact scenario this
// was built to avoid.
const TIMEFRAME_DURATION_MS: Record<Timeframe, number | null> = {
  "1D": DAY_MS,
  "1W": 7 * DAY_MS,
  "1M": 30 * DAY_MS,
  "3M": 90 * DAY_MS,
  "1Y": 365 * DAY_MS,
  ALL: null,
};

// Maps this chart's own timeframe labels to /api/stock/history's accepted
// `range` values (which uses "MAX" rather than "ALL" for the widest view).
const TIMEFRAME_TO_STOCK_RANGE: Record<Timeframe, string> = {
  "1D": "1D",
  "1W": "1W",
  "1M": "1M",
  "3M": "3M",
  "1Y": "1Y",
  ALL: "MAX",
};

interface PerformancePoint {
  date: string;
  value: number;
}

interface ChartRow {
  date: string;
  timestamp: number;
  portfolioValue: number;
  benchmarkValue: number | null;
}

const currencyFormatter = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const compactCurrencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 2,
});

function formatPercent(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function formatSignedCurrency(value: number): string {
  const formatted = currencyFormatter.format(Math.abs(value));
  return `${value >= 0 ? "+" : "-"}${formatted}`;
}

// Slices the full (unfiltered) series down to the selected timeframe's
// window — always keeping one point at-or-before the cutoff as the
// range's own baseline, so "return over this timeframe" has a real start
// value to measure from rather than an arbitrary mid-series first point.
function sliceForTimeframe(series: PerformancePoint[], timeframe: Timeframe): PerformancePoint[] {
  if (timeframe === "ALL" || series.length === 0) return series;
  const duration = TIMEFRAME_DURATION_MS[timeframe]!;
  const cutoff = Date.now() - duration;
  const idx = series.findIndex((p) => new Date(p.date).getTime() >= cutoff);
  if (idx <= 0) return series;
  return series.slice(idx - 1);
}

// Nearest available close on/before the target date — same "walk back
// through real trading days" approach lib/trackers/profile.ts's own
// fetchPriceNear uses for benchmark comparisons elsewhere in this app.
function nearestCloseOnOrBefore(history: { date: string; close: number }[], targetMs: number): number | null {
  let best: { close: number; diff: number } | null = null;
  for (const point of history) {
    const pointMs = new Date(point.date).getTime();
    if (pointMs > targetMs) continue;
    const diff = targetMs - pointMs;
    if (!best || diff < best.diff) best = { close: point.close, diff };
  }
  return best?.close ?? null;
}

function CustomTooltip({
  active,
  payload,
  startingBalance,
  showBenchmark,
}: {
  active?: boolean;
  payload?: Array<{ payload: ChartRow }>;
  startingBalance: number;
  showBenchmark: boolean;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0].payload;
  const lifetimeChange = row.portfolioValue - startingBalance;
  const lifetimePercent = startingBalance > 0 ? (lifetimeChange / startingBalance) * 100 : 0;

  return (
    <div className="rounded-md border border-black/10 bg-background p-3 text-xs shadow-lg dark:border-white/15">
      <p className="mb-1.5 font-medium text-foreground/70">
        {new Date(row.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
      </p>
      <p className="text-sm font-semibold text-foreground">{currencyFormatter.format(row.portfolioValue)}</p>
      <p className={`${lifetimeChange >= 0 ? "text-green-500" : "text-red-500"}`}>
        {formatSignedCurrency(lifetimeChange)} ({formatPercent(lifetimePercent)}) since starting balance
      </p>
      {showBenchmark && row.benchmarkValue != null && (
        <p className="mt-1 border-t border-black/10 pt-1 text-foreground/60 dark:border-white/15">
          S&amp;P 500 (same start): {currencyFormatter.format(row.benchmarkValue)}
        </p>
      )}
    </div>
  );
}

export default function SimulatedPerformanceChart({
  portfolio,
  performanceSeries,
  totalValue,
}: {
  portfolio: { createdAt: string; startingBalance: number };
  performanceSeries: PerformancePoint[];
  totalValue: number;
}) {
  const [timeframe, setTimeframe] = useState<Timeframe>("ALL");
  const [showBenchmark, setShowBenchmark] = useState(false);
  const [benchmarkHistory, setBenchmarkHistory] = useState<{ date: string; close: number }[] | null>(null);

  // Computed via useState's lazy initializer (runs once, on mount) rather
  // than read directly during render or memoized — Date.now() is impure,
  // and both the render body and useMemo callbacks are expected to be
  // pure; a lazy initializer is the sanctioned escape hatch for exactly
  // this kind of one-time, non-idempotent read. A portfolio's age doesn't
  // meaningfully change within one viewing session, so computing it once
  // is all this needs.
  const [ageMs] = useState(() => Date.now() - new Date(portfolio.createdAt).getTime());

  const timeframeEnabled = useMemo(() => {
    const map: Record<Timeframe, boolean> = { "1D": true, "1W": true, "1M": true, "3M": true, "1Y": true, ALL: true };
    for (const tf of TIMEFRAMES) {
      if (tf === "1D" || tf === "ALL") continue;
      const duration = TIMEFRAME_DURATION_MS[tf]!;
      map[tf] = ageMs >= duration;
    }
    return map;
  }, [ageMs]);

  // No effect needed to guard against an invalid selection — every
  // timeframe button is itself disabled (see the render below) whenever
  // timeframeEnabled says it shouldn't be selectable, so setTimeframe is
  // never actually called with a disabled value in the first place.

  const visibleSeries = useMemo(() => sliceForTimeframe(performanceSeries, timeframe), [performanceSeries, timeframe]);

  useEffect(() => {
    let cancelled = false;

    // Both branches (skip-fetch and real-fetch) are deferred behind this
    // macrotask, so setBenchmarkHistory is never called synchronously
    // within the effect body itself.
    const timer = setTimeout(async () => {
      if (cancelled) return;
      if (!showBenchmark) {
        setBenchmarkHistory(null);
        return;
      }

      try {
        const range = TIMEFRAME_TO_STOCK_RANGE[timeframe];
        const response = await fetch(`/api/stock/history?ticker=SPY&interval=1day&range=${range}`);
        const body = await response.json().catch(() => null);
        if (cancelled) return;
        setBenchmarkHistory(response.ok && Array.isArray(body?.history) ? body.history : null);
      } catch {
        if (!cancelled) setBenchmarkHistory(null);
      }
    }, 0);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [showBenchmark, timeframe]);

  const chartData: ChartRow[] = useMemo(() => {
    if (visibleSeries.length === 0) return [];

    const startValue = visibleSeries[0].value;
    const startSpyClose =
      benchmarkHistory && benchmarkHistory.length > 0
        ? nearestCloseOnOrBefore(benchmarkHistory, new Date(visibleSeries[0].date).getTime())
        : null;

    return visibleSeries.map((point) => {
      const pointMs = new Date(point.date).getTime();
      let benchmarkValue: number | null = null;
      if (benchmarkHistory && startSpyClose != null && startSpyClose > 0) {
        const closeAtPoint = nearestCloseOnOrBefore(benchmarkHistory, pointMs);
        if (closeAtPoint != null) {
          benchmarkValue = startValue * (closeAtPoint / startSpyClose);
        }
      }
      return { date: point.date, timestamp: pointMs, portfolioValue: point.value, benchmarkValue };
    });
  }, [visibleSeries, benchmarkHistory]);

  const first = chartData[0];
  const last = chartData[chartData.length - 1];
  const timeframeReturn = first && last ? last.portfolioValue - first.portfolioValue : 0;
  const timeframeReturnPercent = first && first.portfolioValue > 0 ? (timeframeReturn / first.portfolioValue) * 100 : 0;

  const benchmarkReturnPercent =
    first?.benchmarkValue != null && last?.benchmarkValue != null && first.benchmarkValue > 0
      ? ((last.benchmarkValue - first.benchmarkValue) / first.benchmarkValue) * 100
      : null;

  const isUp = timeframeReturn >= 0;

  return (
    <section className={cardClass("neutral", { extra: "flex flex-col gap-3 p-4" })}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-foreground">Performance Over Time</h2>
        <label className="flex items-center gap-1.5 text-xs text-foreground/60">
          <input
            type="checkbox"
            checked={showBenchmark}
            onChange={(e) => setShowBenchmark(e.target.checked)}
            className="h-3.5 w-3.5 accent-indigo-400"
          />
          Compare to S&amp;P 500
        </label>
      </div>

      <div className="flex gap-1">
        {TIMEFRAMES.map((tf) => {
          const enabled = timeframeEnabled[tf];
          return (
            <button
              key={tf}
              type="button"
              disabled={!enabled}
              onClick={() => setTimeframe(tf)}
              title={enabled ? undefined : "Not enough history yet"}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-all duration-200 ease-out ${
                !enabled
                  ? "cursor-not-allowed text-foreground/25"
                  : timeframe === tf
                    ? "bg-foreground text-background"
                    : "border border-black/10 text-foreground/60 hover:border-black/25 dark:border-white/15"
              }`}
            >
              {tf}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-[11px] text-foreground/50">Current Total Value</span>
          <span className="text-base font-semibold text-foreground">
            <AnimatedNumber value={totalValue} format={compactCurrencyFormatter.format} />
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[11px] text-foreground/50">Return ({timeframe})</span>
          <span className={`text-base font-semibold ${isUp ? "text-green-500" : "text-red-500"}`}>
            <AnimatedNumber value={timeframeReturn} format={formatSignedCurrency} /> (
            <AnimatedNumber value={timeframeReturnPercent} format={formatPercent} />)
          </span>
        </div>
        {showBenchmark && (
          <div className="flex flex-col gap-0.5">
            <span className="text-[11px] text-foreground/50">vs. S&amp;P 500 ({timeframe})</span>
            <span
              className={`text-base font-semibold ${
                benchmarkReturnPercent == null
                  ? "text-foreground/40"
                  : timeframeReturnPercent >= benchmarkReturnPercent
                    ? "text-green-500"
                    : "text-red-500"
              }`}
            >
              {benchmarkReturnPercent != null
                ? `${formatPercent(timeframeReturnPercent - benchmarkReturnPercent)} pts`
                : "—"}
            </span>
          </div>
        )}
      </div>

      {showBenchmark && (
        <div className="flex items-center gap-4 text-[11px] text-foreground/60">
          <span className="flex items-center gap-1.5">
            <span className={`h-0.5 w-4 rounded-full ${isUp ? "bg-green-500" : "bg-red-500"}`} />
            Your Portfolio
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded-full border-t-2 border-dashed border-amber-500" />
            S&amp;P 500
          </span>
        </div>
      )}

      {chartData.length > 1 ? (
        <div className="h-56 w-full" key={timeframe}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData}>
              <defs>
                <linearGradient id="simulatedPortfolioGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={isUp ? "#22c55e" : "#ef4444"} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={isUp ? "#22c55e" : "#ef4444"} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.06} />
              <XAxis
                dataKey="date"
                tickFormatter={(d) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                tick={{ fontSize: 11 }}
              />
              <YAxis tick={{ fontSize: 11 }} domain={["auto", "auto"]} tickFormatter={(v) => compactCurrencyFormatter.format(Number(v))} />
              <Tooltip content={<CustomTooltip startingBalance={portfolio.startingBalance} showBenchmark={showBenchmark} />} />
              <Area
                type="monotone"
                dataKey="portfolioValue"
                stroke={isUp ? "#22c55e" : "#ef4444"}
                strokeWidth={2}
                fill="url(#simulatedPortfolioGradient)"
                dot={chartData.length <= 10 ? { r: 3 } : false}
                isAnimationActive
                animationDuration={600}
                animationEasing="ease-out"
              />
              {showBenchmark && (
                <Line
                  type="monotone"
                  dataKey="benchmarkValue"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  strokeDasharray="4 3"
                  dot={false}
                  isAnimationActive
                  animationDuration={600}
                  animationEasing="ease-out"
                  connectNulls
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-lg bg-foreground/5 p-4 text-foreground/50">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-foreground/5">
            <TrendingUp size={18} />
          </div>
          <div className="flex flex-col gap-0.5">
            <p className="text-sm font-medium text-foreground/70">Your performance will appear here</p>
            <p className="text-xs">One point is recorded per day — check back tomorrow to see your first trend line.</p>
          </div>
        </div>
      )}

      {chartData.length > 1 && chartData.length < SPARSE_HISTORY_POINT_COUNT && (
        <p className="text-[11px] italic text-foreground/40">
          Still building history — check back daily as more of your performance builds in.
        </p>
      )}

      <p className="text-[11px] leading-relaxed text-foreground/40">
        {showBenchmark
          ? "S&P 500 line shows what the portfolio's value at the start of this window would be worth today if invested in SPY instead, tracked using real SPY closing prices."
          : "One point per day since this portfolio was created; the most recent point reflects live prices."}
      </p>
    </section>
  );
}
