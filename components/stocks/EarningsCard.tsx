"use client";

import { useEffect, useState } from "react";
import { CartesianGrid, ComposedChart, Line, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { cardClass } from "@/lib/cardStyles";
import { useInViewOnce } from "@/lib/useInViewOnce";

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

// Computed once when the data arrives (inside the effect) rather than
// from Date.now() during render — render must stay pure/deterministic,
// and days-until-earnings doesn't need to tick live anyway.
interface EarningsState extends EarningsData {
  daysUntil: number | null;
}

interface EarningsChartPoint {
  label: string;
  estimate: number | null;
  actual: number | null;
  beat: boolean | null;
  surprisePercent: number | null;
}

const ESTIMATE_COLOR = "#94a3b8"; // slate-400 — muted, matches "Fair/Hold" gray used elsewhere in this app
const BEAT_COLOR = "#22c55e"; // green-500
const MISS_COLOR = "#ef4444"; // red-500

function formatCountdown(days: number): string {
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days < 0) return "recently reported";
  return `in ${days} days`;
}

function formatEps(value: number | null): string {
  return value === null ? "—" : `$${value.toFixed(2)}`;
}

// An estimate point and its quarter's actual dot sit at the SAME x
// position (only their y differs), so recharts' own axis-indexed Tooltip
// can't tell which one the cursor is actually nearest to — it merges both
// series into one shared tooltip per x-column regardless. Each dot
// instead reports its own hover directly (see EstimateDot/ActualDot
// below), and this piece of state drives a custom-positioned tooltip so
// the two hover states can show genuinely different content.
interface HoverState {
  type: "estimate" | "actual";
  point: EarningsChartPoint;
  cx: number;
  cy: number;
}

function HoverTooltip({ hover }: { hover: HoverState }) {
  const { type, point, cx, cy } = hover;

  return (
    <div
      className="pointer-events-none absolute z-10 rounded-md border border-black/10 bg-background/95 px-3 py-2 text-xs shadow-lg ring-1 ring-black/5 backdrop-blur-sm dark:border-white/15 dark:ring-white/10"
      style={{ left: cx, top: cy, transform: "translate(-50%, -120%)" }}
    >
      <p className="mb-1 font-semibold text-foreground">{point.label}</p>
      {type === "estimate" ? (
        <p className="text-foreground/70">
          Estimate: <span className="font-medium text-foreground">{formatEps(point.estimate)}</span>
        </p>
      ) : (
        <>
          <p className="text-foreground/70">
            Estimate: <span className="font-medium text-foreground">{formatEps(point.estimate)}</span>
          </p>
          <p className="text-foreground/70">
            Actual:{" "}
            <span
              className={`font-medium ${
                point.beat === null ? "text-foreground" : point.beat ? "text-green-500" : "text-red-500"
              }`}
            >
              {formatEps(point.actual)}
            </span>
          </p>
          {point.surprisePercent !== null && (
            <p className="mt-1 text-foreground/50">
              {point.surprisePercent >= 0 ? "+" : ""}
              {point.surprisePercent.toFixed(1)}% surprise
            </p>
          )}
        </>
      )}
    </div>
  );
}

interface DotProps {
  cx?: number;
  cy?: number;
  payload?: EarningsChartPoint;
  onHover?: (hover: HoverState | null) => void;
}

// The estimate line's own point markers — small, muted, matching the
// dashed line they sit on. Each reports its own hover directly (see
// HoverState above) rather than relying on recharts' shared Tooltip.
function EstimateDot({ cx, cy, payload, onHover }: DotProps) {
  if (cx == null || cy == null || !payload || payload.estimate === null) return null;
  return (
    <circle
      cx={cx}
      cy={cy}
      r={5}
      fill={ESTIMATE_COLOR}
      stroke="var(--color-background)"
      strokeWidth={1.5}
      style={{ cursor: "pointer" }}
      onMouseEnter={() => onHover?.({ type: "estimate", point: payload, cx, cy })}
      onMouseLeave={() => onHover?.(null)}
    />
  );
}

// The actual-result dots — the primary visual. Deliberately rendered via
// a Line with stroke="none" (dots only, no connecting line of its own)
// rather than a Scatter series, so it shares the exact same categorical
// x-axis positioning as the estimate line without any axis-type
// coordination between chart types. Each dot's vertical position is just
// its own real `actual` EPS value plotted on the same dollar axis as the
// estimate line — the visible gap between a dot and the dashed line at
// that quarter is therefore the real surprise magnitude, not a
// separately-computed or fixed offset.
function ActualDot({ cx, cy, payload, onHover }: DotProps) {
  if (cx == null || cy == null || !payload || payload.actual === null) return null;
  const color = payload.beat === null ? ESTIMATE_COLOR : payload.beat ? BEAT_COLOR : MISS_COLOR;
  return (
    <circle
      cx={cx}
      cy={cy}
      r={6}
      fill={color}
      stroke="var(--color-background)"
      strokeWidth={2}
      style={{ cursor: "pointer" }}
      onMouseEnter={() => onHover?.({ type: "actual", point: payload, cx, cy })}
      onMouseLeave={() => onHover?.(null)}
    />
  );
}

function EarningsChartLegend() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-foreground/60">
      <span className="flex items-center gap-1.5">
        <svg width="14" height="8" className="shrink-0">
          <line x1="0" y1="4" x2="14" y2="4" stroke={ESTIMATE_COLOR} strokeWidth="2" strokeDasharray="3 2" />
        </svg>
        Estimate
      </span>
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: BEAT_COLOR }} />
        Beat
      </span>
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: MISS_COLOR }} />
        Missed
      </span>
    </div>
  );
}

export default function EarningsCard({ ticker }: { ticker: string }) {
  const [data, setData] = useState<EarningsState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hover, setHover] = useState<HoverState | null>(null);
  const { ref: chartRef, visible: chartVisible } = useInViewOnce<HTMLDivElement>();

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!cancelled) {
        setData(null);
        setError(null);
      }

      try {
        const response = await fetch(`/api/stock/earnings?ticker=${encodeURIComponent(ticker)}`);
        if (!response.ok) throw new Error("request failed");
        const body: EarningsData = await response.json();
        if (cancelled) return;

        const daysUntil = body.nextEarningsDate
          ? Math.round(
              (new Date(`${body.nextEarningsDate}T00:00:00Z`).getTime() - Date.now()) / 86_400_000
            )
          : null;
        setData({ ...body, daysUntil });
      } catch {
        if (!cancelled) setError("Data unavailable");
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [ticker]);

  const daysUntil = data?.daysUntil ?? null;
  const isUrgent = daysUntil !== null && daysUntil >= 0 && daysUntil <= 7;

  const chartData: EarningsChartPoint[] = (data?.quarters ?? []).map((quarter) => ({
    label: `Q${quarter.quarter} '${String(quarter.year).slice(2)}`,
    estimate: quarter.estimate,
    actual: quarter.actual,
    beat:
      quarter.actual !== null && quarter.estimate !== null ? quarter.actual >= quarter.estimate : null,
    surprisePercent: quarter.surprisePercent,
  }));

  return (
    <div className={cardClass("neutral", { extra: "flex flex-col gap-3 p-4" })}>
      <h3 className="font-semibold text-foreground">Earnings</h3>

      {!data && !error && (
        <div className="flex flex-col gap-2">
          <div className="h-8 w-full animate-pulse rounded bg-foreground/10" />
          <div className="h-40 w-full animate-pulse rounded bg-foreground/10" />
        </div>
      )}

      {error && <p className="text-sm text-foreground/60">Data unavailable</p>}

      {data && (
        <>
          {data.nextEarningsDate && daysUntil !== null ? (
            <div
              className={`flex flex-wrap items-center gap-2 rounded-md px-3 py-2 text-sm ${
                isUrgent ? "bg-amber-500/10" : "bg-foreground/5"
              }`}
            >
              {isUrgent && <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-amber-500" />}
              <span className="text-foreground/70">Next earnings:</span>
              <span className="font-medium text-foreground">
                {new Date(`${data.nextEarningsDate}T00:00:00Z`).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
              <span className={isUrgent ? "font-medium text-amber-500" : "text-foreground/60"}>
                ({formatCountdown(daysUntil)})
              </span>
            </div>
          ) : (
            <p className="text-sm text-foreground/60">No upcoming earnings date available.</p>
          )}

          {chartData.length > 0 ? (
            <>
              <div ref={chartRef} className="relative h-40 w-full">
                {chartVisible && (
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData} margin={{ top: 16, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.06} />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={{ opacity: 0.15 }} />
                      <YAxis tick={{ fontSize: 11 }} width={32} tickLine={false} axisLine={{ opacity: 0.15 }} />
                      <Line
                        dataKey="estimate"
                        name="Estimate"
                        stroke={ESTIMATE_COLOR}
                        strokeWidth={2}
                        strokeDasharray="5 5"
                        dot={<EstimateDot onHover={setHover} />}
                        isAnimationActive={false}
                        connectNulls
                      />
                      <Line
                        dataKey="actual"
                        name="Actual"
                        stroke="none"
                        dot={<ActualDot onHover={setHover} />}
                        isAnimationActive={false}
                        connectNulls
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                )}
                {hover && <HoverTooltip hover={hover} />}
              </div>
              <EarningsChartLegend />
            </>
          ) : (
            <p className="text-sm text-foreground/60">No earnings history available.</p>
          )}
        </>
      )}
    </div>
  );
}
