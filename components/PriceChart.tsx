"use client";

import { useEffect, useRef, useState } from "react";
import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  createChart,
  HistogramSeries,
  IChartApi,
  ISeriesApi,
  LineSeries,
  LineStyle,
  LogicalRange,
  MouseEventParams,
  Time,
  TrackingModeExitMode,
  UTCTimestamp,
} from "lightweight-charts";

const VOLUME_PRICE_SCALE_ID = "volume";

// Extracted from app/stocks/page.tsx (previously named StockChart) so
// /crypto can reuse the exact same charting behavior — this component was
// already fully generic (it only ever receives OHLCV history + a handful
// of primitive/callback props; it doesn't know or care what kind of asset
// it's charting), so the extraction is a pure move with no logic changes.

export type HistoryPoint = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
};

export type Interval = "1min" | "5min" | "15min" | "30min" | "1h" | "4h" | "1day";
export type Range = "1D" | "1W" | "1M" | "3M" | "YTD" | "1Y" | "5Y" | "MAX";
export type ChartType = "line" | "candlestick";

export const RANGES: { label: string; value: Range }[] = [
  { label: "1D", value: "1D" },
  { label: "1W", value: "1W" },
  { label: "1M", value: "1M" },
  { label: "3M", value: "3M" },
  { label: "YTD", value: "YTD" },
  { label: "1Y", value: "1Y" },
  { label: "5Y", value: "5Y" },
  { label: "MAX", value: "MAX" },
];

// The compact view has no interval picker (it only appears when expanded),
// so switching ranges must also pick a sensible granularity itself —
// otherwise the interval stays wherever it was (e.g. "5min" from 1D) and a
// wide range like 1Y+ silently gets clamped to its most recent few days
// once the 5000-bar cap is hit, while still being labeled as the full range.
export const DEFAULT_INTERVAL_FOR_RANGE: Record<Range, Interval> = {
  "1D": "5min",
  "1W": "30min",
  "1M": "1h",
  "3M": "1day",
  "YTD": "1day",
  "1Y": "1day",
  "5Y": "1day",
  "MAX": "1day",
};

export const INTERVALS: { label: string; value: Interval }[] = [
  { label: "1m", value: "1min" },
  { label: "5m", value: "5min" },
  { label: "15m", value: "15min" },
  { label: "30m", value: "30min" },
  { label: "1h", value: "1h" },
  { label: "4h", value: "4h" },
  { label: "1D", value: "1day" },
];

export function formatPrice(value: number): string {
  return `$${value.toFixed(2)}`;
}

export function toUnixTime(dateStr: string): UTCTimestamp {
  const iso = dateStr.includes(" ")
    ? `${dateStr.replace(" ", "T")}Z`
    : `${dateStr}T00:00:00Z`;
  return Math.floor(new Date(iso).getTime() / 1000) as UTCTimestamp;
}

function timeToMs(time: Time): number {
  if (typeof time === "number") {
    return time * 1000;
  }
  if (typeof time === "string") {
    return new Date(`${time}T00:00:00Z`).getTime();
  }
  return Date.UTC(time.year, time.month - 1, time.day);
}

function formatShortDate(ms: number): string {
  return new Date(ms).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function formatShortTime(ms: number): string {
  return new Date(ms).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  });
}

function formatShortDateWithYear(ms: number): string {
  return new Date(ms).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

// Snaps a timestamp back to the Monday of its week (UTC), used to label
// the 1Y view by week rather than by individual day.
function startOfWeekMs(ms: number): number {
  const dayOfWeek = new Date(ms).getUTCDay();
  const daysSinceMonday = (dayOfWeek + 6) % 7;
  return ms - daysSinceMonday * 24 * 60 * 60 * 1000;
}

export function formatTickForRange(time: Time, range: Range): string {
  const ms = timeToMs(time);

  switch (range) {
    case "1D":
      return formatShortTime(ms);
    case "5Y":
    case "MAX":
      return formatShortDateWithYear(ms);
    case "YTD":
    case "1Y":
      return formatShortDate(startOfWeekMs(ms));
    case "1W":
    case "1M":
    case "3M":
    default:
      return formatShortDate(ms);
  }
}

export function formatTooltipTimestamp(dateStr: string): string {
  const ms = toUnixTime(dateStr) * 1000;
  return dateStr.includes(" ")
    ? `${formatShortDate(ms)} ${formatShortTime(ms)}`
    : formatShortDate(ms);
}

export function formatVolume(value: number): string {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatDollarChange(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  if (rounded === 0) return "$0.00";
  const sign = rounded > 0 ? "+" : "-";
  return `${sign}$${Math.abs(rounded).toFixed(2)}`;
}

export function changeColorClass(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  if (rounded === 0) return "text-foreground/60";
  return rounded > 0 ? "text-green-500" : "text-red-500";
}

export function PercentChangeBadge({ value }: { value: number }) {
  const rounded = Math.round(value * 100) / 100;

  if (rounded === 0) {
    return (
      <span className="text-sm font-medium text-foreground/60 transition-colors duration-200">
        0.00%
      </span>
    );
  }

  const isPositive = rounded > 0;

  return (
    <span
      className={`text-sm font-medium transition-colors duration-200 ${
        isPositive ? "text-green-500" : "text-red-500"
      }`}
    >
      {isPositive ? "▲" : "▼"} {isPositive ? "+" : ""}
      {rounded.toFixed(2)}%
    </span>
  );
}

// "neutral" (default) is the original monochrome treatment, unchanged for
// every existing caller (including every crypto page usage, which doesn't
// pass `accent`). "blue" is opt-in — the stock section's page-wide
// interactive accent, so its own range/type/toggle pills read as one
// consistent color language without recoloring this shared component's
// default for callers that never asked for it.
export function PillButton({
  active,
  onClick,
  children,
  accent = "neutral",
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  accent?: "neutral" | "blue";
}) {
  const activeClass =
    accent === "blue" ? "bg-blue-500 text-white" : "bg-foreground text-background";

  return (
    <button
      onClick={onClick}
      className={`rounded-md px-2.5 py-2 text-xs font-medium transition-all duration-200 ease-out active:scale-95 ${
        active
          ? activeClass
          : "border border-black/10 text-foreground/60 hover:border-black/25 hover:text-foreground dark:border-white/15 dark:hover:border-white/30"
      }`}
    >
      {children}
    </button>
  );
}

const LEFT_EDGE_THRESHOLD = 5;

export default function PriceChart({
  history,
  historyGeneration,
  chartType,
  range,
  interval,
  locked,
  isExpanded,
  loadingMore,
  showVolume = false,
  compareHistory = null,
  showComparison = false,
  onNearLeftEdge,
  onHoverChange,
}: {
  history: HistoryPoint[];
  historyGeneration: number;
  chartType: ChartType;
  range: Range;
  interval: Interval;
  locked: boolean;
  isExpanded: boolean;
  loadingMore: boolean;
  showVolume?: boolean;
  // The comparison ticker's own history for the same range/interval —
  // fetched by the parent (this component stays a pure presentational
  // chart, same as it's always been for the primary `history`).
  compareHistory?: HistoryPoint[] | null;
  showComparison?: boolean;
  onNearLeftEdge: () => void;
  onHoverChange: (point: HistoryPoint | null) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<
    ISeriesApi<"Line"> | ISeriesApi<"Candlestick"> | null
  >(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const compareSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const previousHistoryRef = useRef<HistoryPoint[] | null>(null);
  const previousGenerationRef = useRef<number | null>(null);
  const onNearLeftEdgeRef = useRef(onNearLeftEdge);
  const onHoverChangeRef = useRef(onHoverChange);
  const lockedRef = useRef(locked);
  // `interval`/`range` are read via refs (not effect deps) in the main data
  // effect below: they change synchronously in the range-pill click handler
  // before the async history fetch resolves, so depending on them directly
  // would rebuild the chart once with the *new* range/interval but the
  // *stale* (old) history — that premature fitContent() call corrupts the
  // chart's zoom state before the real data arrives moments later.
  const intervalRef = useRef(interval);
  const rangeRef = useRef(range);
  // Read inside the crosshair handler (below) instead of as effect deps, so
  // the subscription is created once per chart instance rather than being
  // torn down and recreated on every history update or hover — see the
  // comment on that effect for why the churn itself was the bug.
  const historyRef = useRef(history);
  const hoverPointRef = useRef<HistoryPoint | null>(null);

  const [hoverPoint, setHoverPoint] = useState<HistoryPoint | null>(null);
  const [visibleRange, setVisibleRangeState] = useState<LogicalRange | null>(
    null
  );
  // Briefly dims the chart around a range/interval/chart-type switch so the
  // redraw reads as a smooth transition instead of an abrupt jump to a
  // differently-scaled dataset or series type (lightweight-charts has no
  // built-in tween between two series).
  const [fading, setFading] = useState(false);
  const previousRangeRef = useRef<Range | null>(null);
  const previousIntervalRef = useRef<Interval | null>(null);
  const previousChartTypeRef = useRef<ChartType | null>(null);
  const previousComparisonRef = useRef<boolean | null>(null);

  useEffect(() => {
    intervalRef.current = interval;
  }, [interval]);

  useEffect(() => {
    rangeRef.current = range;
  }, [range]);

  useEffect(() => {
    historyRef.current = history;
  }, [history]);

  useEffect(() => {
    hoverPointRef.current = hoverPoint;
  }, [hoverPoint]);

  useEffect(() => {
    onNearLeftEdgeRef.current = onNearLeftEdge;
  }, [onNearLeftEdge]);

  useEffect(() => {
    onHoverChangeRef.current = onHoverChange;
  }, [onHoverChange]);

  useEffect(() => {
    onHoverChangeRef.current(hoverPoint);
  }, [hoverPoint]);

  useEffect(() => {
    lockedRef.current = locked;
  }, [locked]);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#9ca3af",
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { visible: false },
      },
      // rightPriceScale visibility (Y-axis labels hidden in the compact
      // view, shown once expanded) is set by the isExpanded-keyed effect
      // below, which runs immediately after this one on mount too — kept
      // out of here so this effect doesn't need isExpanded in its deps
      // and recreate the whole chart every time expand/collapse toggles.
      crosshair: {
        mode: CrosshairMode.Magnet,
        vertLine: {
          color: "rgba(148,163,184,0.6)",
          width: 1,
          style: LineStyle.Dotted,
          labelVisible: false,
        },
        horzLine: {
          // No horizontal crosshair line — the scrubbed value is carried by
          // the price header and the dot marker on the line itself.
          visible: false,
          labelVisible: false,
        },
      },
      trackingMode: {
        // Lets touch-drag scrubbing keep the crosshair (and the price
        // header it drives) following the finger continuously, only
        // releasing back to the latest point once the touch ends.
        exitMode: TrackingModeExitMode.OnTouchEnd,
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        rightOffsetPixels: 30,
      },
    });

    chartRef.current = chart;

    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      volumeSeriesRef.current = null;
      compareSeriesRef.current = null;
    };
  }, []);

  // The formatter depends on `range`, so it's applied separately from chart
  // creation and re-applied whenever the selected range changes.
  useEffect(() => {
    chartRef.current?.applyOptions({
      timeScale: {
        tickMarkFormatter: (time: Time) => formatTickForRange(time, range),
      },
    });
  }, [range]);

  // Toggling expand/collapse should show or hide the Y-axis without
  // recreating the whole chart, so this is kept separate from setup.
  useEffect(() => {
    chartRef.current?.applyOptions({
      rightPriceScale: { visible: isExpanded },
    });
  }, [isExpanded]);

  // Locked disables direct drag/touch panning (a slider takes over instead)
  // but always leaves wheel/pinch zoom enabled.
  useEffect(() => {
    chartRef.current?.applyOptions({
      handleScroll: {
        mouseWheel: !locked,
        pressedMouseMove: !locked,
        horzTouchDrag: !locked,
        vertTouchDrag: !locked,
      },
      handleScale: {
        mouseWheel: true,
        pinch: true,
        axisPressedMouseMove: true,
        axisDoubleClickReset: true,
      },
    });
  }, [locked]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || history.length === 0) return;

    // An infinite-scroll prepend adds older bars to the front while keeping
    // the same trailing data; detect that so we can preserve the user's
    // scroll position instead of resetting the view like a fresh load does.
    // This is driven by historyGeneration (bumped only on a genuinely fresh
    // load, not on a prepend) rather than by comparing sample dates — two
    // different ranges can coincidentally share an end date and align at
    // the computed offset index, which made the old date-comparison
    // heuristic misfire and corrupt the chart's zoom on rapid range
    // switches.
    const previous = previousHistoryRef.current;
    const isFreshLoad =
      previousGenerationRef.current === null ||
      previousGenerationRef.current !== historyGeneration;
    previousGenerationRef.current = historyGeneration;

    const prependedCount =
      !isFreshLoad && previous && history.length > previous.length
        ? history.length - previous.length
        : 0;
    previousHistoryRef.current = history;

    // Comparison mode always renders as a line (a normalized-%% comparison
    // doesn't have a meaningful candlestick form) and plots % change from
    // the period start instead of raw price, so both tickers share one
    // sensible axis regardless of their actual dollar prices.
    const usesComparison = showComparison && !!compareHistory && compareHistory.length > 0;
    const effectiveChartType: ChartType = usesComparison ? "line" : chartType;

    // A genuine range/interval/chart-type/comparison switch (not a prepend
    // within the same settings) gets a brief cross-fade so the redraw reads
    // as smooth rather than an abrupt jump — lightweight-charts has no
    // built-in tween between two datasets of different length/scale or
    // between a line and candlestick series, so this is done with a CSS
    // opacity dip.
    const currentRangeValue = rangeRef.current;
    const currentIntervalValue = intervalRef.current;
    const rangeChanged =
      previousRangeRef.current !== null && previousRangeRef.current !== currentRangeValue;
    const intervalChanged =
      previousIntervalRef.current !== null && previousIntervalRef.current !== currentIntervalValue;
    const chartTypeChanged =
      previousChartTypeRef.current !== null && previousChartTypeRef.current !== effectiveChartType;
    const comparisonChanged =
      previousComparisonRef.current !== null && previousComparisonRef.current !== usesComparison;
    previousRangeRef.current = currentRangeValue;
    previousIntervalRef.current = currentIntervalValue;
    previousChartTypeRef.current = effectiveChartType;
    previousComparisonRef.current = usesComparison;
    if (rangeChanged || intervalChanged || chartTypeChanged || comparisonChanged) setFading(true);

    if (seriesRef.current) {
      chart.removeSeries(seriesRef.current);
      seriesRef.current = null;
    }
    if (compareSeriesRef.current) {
      chart.removeSeries(compareSeriesRef.current);
      compareSeriesRef.current = null;
    }

    // The line's color reflects the trend over the whole selected period
    // (first bar to last), matching Robinhood's up/down line styling.
    const periodStartClose = history[0].close;
    const periodEndClose = history[history.length - 1].close;
    const lineColor = periodEndClose >= periodStartClose ? "#22c55e" : "#ef4444";

    let series: ISeriesApi<"Line"> | ISeriesApi<"Candlestick">;

    if (effectiveChartType === "line") {
      series = chart.addSeries(LineSeries, {
        color: lineColor,
        lineWidth: 2,
        // Draws a small dot on the line at the scrubbed/crosshair point —
        // the touch/drag "scrubbing" indicator.
        crosshairMarkerVisible: true,
        crosshairMarkerRadius: 5,
        crosshairMarkerBorderColor: lineColor,
        crosshairMarkerBackgroundColor: lineColor,
        crosshairMarkerBorderWidth: 2,
      });
      series.setData(
        history.map((point) => ({
          time: toUnixTime(point.date),
          value: usesComparison ? ((point.close - periodStartClose) / periodStartClose) * 100 : point.close,
        }))
      );
    } else {
      series = chart.addSeries(CandlestickSeries, {
        upColor: "#22c55e",
        downColor: "#ef4444",
        borderVisible: false,
        wickUpColor: "#22c55e",
        wickDownColor: "#ef4444",
      });
      series.setData(
        history.map((point) => ({
          time: toUnixTime(point.date),
          open: point.open,
          high: point.high,
          low: point.low,
          close: point.close,
        }))
      );
    }

    seriesRef.current = series;

    // Subtle dashed reference line at the period's starting price (or at
    // 0% in comparison mode), so it's visually obvious whether the
    // current/scrubbed point sits above or below where the period began.
    series.createPriceLine({
      price: usesComparison ? 0 : periodStartClose,
      color: "rgba(148,163,184,0.6)",
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: false,
      title: "",
    });

    if (usesComparison && compareHistory) {
      const compareBase = compareHistory[0].close;
      const compareSeries = chart.addSeries(LineSeries, {
        color: "#a78bfa",
        lineWidth: 2,
        crosshairMarkerVisible: true,
        crosshairMarkerRadius: 4,
        lastValueVisible: true,
        priceLineVisible: false,
      });
      compareSeries.setData(
        compareHistory.map((point) => ({
          time: toUnixTime(point.date),
          value: ((point.close - compareBase) / compareBase) * 100,
        }))
      );
      compareSeriesRef.current = compareSeries;
    }

    if (prependedCount > 0) {
      // Shift the visible range by exactly how many bars were prepended so
      // the same bars stay on screen — no jump, no flash.
      const currentRange = chart.timeScale().getVisibleLogicalRange();
      if (currentRange) {
        chart.timeScale().setVisibleLogicalRange({
          from: currentRange.from + prependedCount,
          to: currentRange.to + prependedCount,
        });
      }
    } else if (intervalRef.current === "1min") {
      // A full day of 1-minute bars can't all be labeled legibly at once.
      // Show a recent window with enough per-bar width for 1-minute tick
      // marks, and let the user pan left to reach earlier bars.
      const visibleBars = Math.min(10, history.length);
      chart.timeScale().setVisibleLogicalRange({
        from: history.length - visibleBars,
        to: history.length - 1,
      });
    } else {
      chart.timeScale().fitContent();
    }

    setHoverPoint(history[history.length - 1]);

    if (rangeChanged || intervalChanged || chartTypeChanged || comparisonChanged) {
      requestAnimationFrame(() => setFading(false));
    }
    // `interval`/`range` are intentionally read via refs above, not listed
    // here — see the comment on intervalRef/rangeRef for why depending on
    // them directly would rebuild the chart with stale data. `historyGeneration`
    // is safe to depend on directly (unlike interval/range): it's only ever
    // bumped in the same synchronous block as setHistory, so the two always
    // update together in one commit — never in a mismatched intermediate render.
  }, [chartType, history, historyGeneration, showComparison, compareHistory]);

  // Volume is a self-contained secondary series overlaid in the bottom ~20%
  // of the same pane (its own named price scale, not lightweight-charts'
  // newer multi-pane API) — kept in its own effect rather than folded into
  // the main series-building effect above so toggling it on/off never tears
  // down or refits the primary price/candlestick series.
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    if (!showVolume || history.length === 0 || !history.some((point) => point.volume !== undefined)) {
      if (volumeSeriesRef.current) {
        chart.removeSeries(volumeSeriesRef.current);
        volumeSeriesRef.current = null;
      }
      return;
    }

    if (!volumeSeriesRef.current) {
      volumeSeriesRef.current = chart.addSeries(HistogramSeries, {
        priceScaleId: VOLUME_PRICE_SCALE_ID,
        priceFormat: { type: "volume" },
        lastValueVisible: false,
        priceLineVisible: false,
      });
      chart.priceScale(VOLUME_PRICE_SCALE_ID).applyOptions({
        scaleMargins: { top: 0.8, bottom: 0 },
      });
    }

    volumeSeriesRef.current.setData(
      history
        .filter((point) => point.volume !== undefined)
        .map((point) => ({
          time: toUnixTime(point.date),
          value: point.volume as number,
          color: point.close >= point.open ? "rgba(34,197,94,0.5)" : "rgba(239,68,68,0.5)",
        }))
    );
  }, [showVolume, history]);

  // Subscribes exactly once per chart instance rather than depending on
  // `history` — re-subscribing on every history update (every range switch
  // or infinite-scroll load) tore down and recreated the listener on nearly
  // every render, and combined with handleCrosshairMove calling
  // setHoverPoint unconditionally (even for the same point re-hovered),
  // that churn was surfacing as a "Maximum update depth exceeded" loop.
  // `history` and `hoverPoint` are read via refs so this closure always
  // sees current values without needing to be recreated.
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    function handleCrosshairMove(param: MouseEventParams) {
      const currentHistory = historyRef.current;

      if (!param.time) {
        const latest =
          currentHistory.length > 0 ? currentHistory[currentHistory.length - 1] : null;
        // Compare by date (a stable identifier), not object reference —
        // skip the update entirely if we're already showing this point.
        if (latest?.date !== hoverPointRef.current?.date) {
          setHoverPoint(latest);
        }
        return;
      }

      const match = currentHistory.find(
        (point) => toUnixTime(point.date) === param.time
      );
      if (match && match.date !== hoverPointRef.current?.date) {
        setHoverPoint(match);
      }
    }

    chart.subscribeCrosshairMove(handleCrosshairMove);
    return () => chart.unsubscribeCrosshairMove(handleCrosshairMove);
  }, []);

  // Tracks the visible logical range so the OHLCV info box can be gated on
  // zoom level (only shown once zoomed in past the full overview) and so
  // the Locked-mode slider can reflect/drive the current pan position.
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || history.length === 0) {
      setVisibleRangeState(null);
      return;
    }

    function handleRangeChange(logicalRange: LogicalRange | null) {
      setVisibleRangeState(logicalRange);

      const zoomedIn = logicalRange
        ? logicalRange.to - logicalRange.from < history.length * 0.98
        : false;

      if (
        !lockedRef.current &&
        zoomedIn &&
        logicalRange &&
        logicalRange.from < LEFT_EDGE_THRESHOLD
      ) {
        onNearLeftEdgeRef.current();
      }
    }

    chart.timeScale().subscribeVisibleLogicalRangeChange(handleRangeChange);
    handleRangeChange(chart.timeScale().getVisibleLogicalRange());

    return () =>
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(handleRangeChange);
  }, [history]);

  const isZoomedIn = visibleRange
    ? visibleRange.to - visibleRange.from < history.length * 0.98
    : false;

  function handleSliderChange(from: number) {
    const chart = chartRef.current;
    if (!chart || !visibleRange) return;
    const width = visibleRange.to - visibleRange.from;
    chart.timeScale().setVisibleLogicalRange({ from, to: from + width });
  }

  const sliderMax = visibleRange
    ? Math.max(0, history.length - (visibleRange.to - visibleRange.from))
    : 0;

  return (
    <div className="flex h-full w-full flex-col gap-2">
      <div className="relative min-h-0 flex-1">
        <div
          ref={containerRef}
          className="h-full w-full transition-opacity duration-200 ease-out"
          style={{ opacity: fading ? 0.3 : 1 }}
        />
        {loadingMore && (
          <div className="pointer-events-none absolute right-2 top-2 z-10 h-4 w-4 animate-spin rounded-full border-2 border-foreground/20 border-t-foreground" />
        )}
        {isExpanded && isZoomedIn && hoverPoint && (
          <div className="pointer-events-none absolute left-2 top-2 z-10 flex flex-col gap-1 rounded-md bg-background/80 px-2 py-1 text-xs shadow-sm ring-1 ring-black/10 backdrop-blur-sm dark:ring-white/10">
            <span className="text-foreground/60">
              {formatTooltipTimestamp(hoverPoint.date)}
            </span>
            <div className="flex gap-3">
              {chartType === "candlestick" && (
                <>
                  <span className="text-foreground/60">
                    O <span className="font-medium text-foreground">{formatPrice(hoverPoint.open)}</span>
                  </span>
                  <span className="text-foreground/60">
                    H <span className="font-medium text-foreground">{formatPrice(hoverPoint.high)}</span>
                  </span>
                  <span className="text-foreground/60">
                    L <span className="font-medium text-foreground">{formatPrice(hoverPoint.low)}</span>
                  </span>
                </>
              )}
              <span className="text-foreground/60">
                C <span className="font-medium text-foreground">{formatPrice(hoverPoint.close)}</span>
              </span>
              <span className="text-foreground/60">
                Vol{" "}
                <span className="font-medium text-foreground">
                  {hoverPoint.volume !== undefined
                    ? formatVolume(hoverPoint.volume)
                    : formatPrice(hoverPoint.close)}
                </span>
              </span>
            </div>
          </div>
        )}
      </div>
      {locked && visibleRange && (
        <input
          type="range"
          min={0}
          max={sliderMax}
          step={sliderMax > 0 ? sliderMax / 500 : 1}
          value={Math.min(visibleRange.from, sliderMax)}
          onChange={(e) => handleSliderChange(Number(e.target.value))}
          aria-label="Pan visible time window"
          className="w-full shrink-0 accent-foreground"
        />
      )}
    </div>
  );
}
