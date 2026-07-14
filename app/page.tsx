"use client";

import { useEffect, useRef, useState } from "react";
import {
  CandlestickSeries,
  ColorType,
  createChart,
  IChartApi,
  ISeriesApi,
  LineSeries,
  LogicalRange,
  MouseEventParams,
  Time,
  UTCTimestamp,
} from "lightweight-charts";

type StockData = {
  ticker: string;
  close: number;
  open: number;
  high: number;
  low: number;
  percentChange: number;
};

type HistoryPoint = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
};

type Interval = "1min" | "5min" | "15min" | "30min" | "1h" | "4h" | "1day";
type Range = "1D" | "1W" | "1M" | "3M" | "1Y";
type ChartType = "line" | "candlestick";

const RANGES: { label: string; value: Range }[] = [
  { label: "1D", value: "1D" },
  { label: "1W", value: "1W" },
  { label: "1M", value: "1M" },
  { label: "3M", value: "3M" },
  { label: "1Y", value: "1Y" },
];

const INTERVALS: { label: string; value: Interval }[] = [
  { label: "1m", value: "1min" },
  { label: "5m", value: "5min" },
  { label: "15m", value: "15min" },
  { label: "30m", value: "30min" },
  { label: "1h", value: "1h" },
  { label: "4h", value: "4h" },
  { label: "1D", value: "1day" },
];

function formatPrice(value: number): string {
  return `$${value.toFixed(2)}`;
}

function toUnixTime(dateStr: string): UTCTimestamp {
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

// Snaps a timestamp back to the Monday of its week (UTC), used to label
// the 1Y view by week rather than by individual day.
function startOfWeekMs(ms: number): number {
  const dayOfWeek = new Date(ms).getUTCDay();
  const daysSinceMonday = (dayOfWeek + 6) % 7;
  return ms - daysSinceMonday * 24 * 60 * 60 * 1000;
}

function formatTickForRange(time: Time, range: Range): string {
  const ms = timeToMs(time);

  switch (range) {
    case "1D":
      return formatShortTime(ms);
    case "1Y":
      return formatShortDate(startOfWeekMs(ms));
    case "1W":
    case "1M":
    case "3M":
    default:
      return formatShortDate(ms);
  }
}

function formatTooltipTimestamp(dateStr: string): string {
  const ms = toUnixTime(dateStr) * 1000;
  return dateStr.includes(" ")
    ? `${formatShortDate(ms)} ${formatShortTime(ms)}`
    : formatShortDate(ms);
}

function formatVolume(value: number): string {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function PercentChangeBadge({ value }: { value: number }) {
  const rounded = Math.round(value * 100) / 100;

  if (rounded === 0) {
    return <span className="text-sm font-medium text-foreground/60">0.00%</span>;
  }

  const isPositive = rounded > 0;

  return (
    <span
      className={`text-sm font-medium ${
        isPositive ? "text-green-500" : "text-red-500"
      }`}
    >
      {isPositive ? "▲" : "▼"} {isPositive ? "+" : ""}
      {rounded.toFixed(2)}%
    </span>
  );
}

type PriceScaleMode = "free" | "locked";

function applyPriceScaleLock(
  series: ISeriesApi<"Line"> | ISeriesApi<"Candlestick">,
  locked: boolean
) {
  const priceScale = series.priceScale();
  if (locked) {
    const visibleRange = priceScale.getVisibleRange();
    if (visibleRange) {
      priceScale.setVisibleRange(visibleRange);
    }
    priceScale.setAutoScale(false);
  } else {
    priceScale.setAutoScale(true);
  }
}

function PillButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md px-2.5 py-1 text-xs font-medium ${
        active
          ? "bg-foreground text-background"
          : "border border-black/10 text-foreground/60 hover:text-foreground dark:border-white/15"
      }`}
    >
      {children}
    </button>
  );
}

function StockChart({
  history,
  chartType,
  range,
  interval,
  priceScaleMode,
}: {
  history: HistoryPoint[];
  chartType: ChartType;
  range: Range;
  interval: Interval;
  priceScaleMode: PriceScaleMode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<
    ISeriesApi<"Line"> | ISeriesApi<"Candlestick"> | null
  >(null);
  const priceScaleModeRef = useRef(priceScaleMode);

  const [hoverPoint, setHoverPoint] = useState<HistoryPoint | null>(null);
  const [isZoomedIn, setIsZoomedIn] = useState(false);

  useEffect(() => {
    priceScaleModeRef.current = priceScaleMode;
  }, [priceScaleMode]);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#9ca3af",
      },
      grid: {
        vertLines: { color: "rgba(128,128,128,0.1)" },
        horzLines: { color: "rgba(128,128,128,0.1)" },
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

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || history.length === 0) return;

    if (seriesRef.current) {
      chart.removeSeries(seriesRef.current);
      seriesRef.current = null;
    }

    let series: ISeriesApi<"Line"> | ISeriesApi<"Candlestick">;

    if (chartType === "line") {
      series = chart.addSeries(LineSeries, {
        color: "#22c55e",
        lineWidth: 2,
      });
      series.setData(
        history.map((point) => ({
          time: toUnixTime(point.date),
          value: point.close,
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

    // A full day of 1-minute bars can't all be labeled legibly at once.
    // Show a recent window with enough per-bar width for 1-minute tick
    // marks, and let the user pan left to reach earlier bars.
    if (interval === "1min") {
      const visibleBars = Math.min(10, history.length);
      chart.timeScale().setVisibleLogicalRange({
        from: history.length - visibleBars,
        to: history.length - 1,
      });
    } else {
      chart.timeScale().fitContent();
    }

    applyPriceScaleLock(series, priceScaleModeRef.current === "locked");
    setHoverPoint(history[history.length - 1]);
  }, [chartType, history, interval]);

  // Applied separately so toggling Locked/Free doesn't recreate the series
  // (which would reset zoom/pan position).
  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;
    applyPriceScaleLock(series, priceScaleMode === "locked");
  }, [priceScaleMode]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    function handleCrosshairMove(param: MouseEventParams) {
      if (!param.time) {
        setHoverPoint(history.length > 0 ? history[history.length - 1] : null);
        return;
      }
      const match = history.find(
        (point) => toUnixTime(point.date) === param.time
      );
      if (match) setHoverPoint(match);
    }

    chart.subscribeCrosshairMove(handleCrosshairMove);
    return () => chart.unsubscribeCrosshairMove(handleCrosshairMove);
  }, [history]);

  // The OHLCV info box only makes sense once the user has zoomed in past
  // the fully-zoomed-out overview; track that via the visible logical range.
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || history.length === 0) {
      setIsZoomedIn(false);
      return;
    }

    function handleRangeChange(logicalRange: LogicalRange | null) {
      if (!logicalRange) {
        setIsZoomedIn(false);
        return;
      }
      const visibleBars = logicalRange.to - logicalRange.from;
      setIsZoomedIn(visibleBars < history.length * 0.98);
    }

    chart.timeScale().subscribeVisibleLogicalRangeChange(handleRangeChange);
    handleRangeChange(chart.timeScale().getVisibleLogicalRange());

    return () =>
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(handleRangeChange);
  }, [history]);

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />
      {isZoomedIn && hoverPoint && (
        <div className="pointer-events-none absolute left-2 top-2 z-10 flex flex-col gap-1 rounded-md bg-background/80 px-2 py-1 text-xs shadow-sm ring-1 ring-black/10 backdrop-blur-sm dark:ring-white/10">
          <span className="text-foreground/60">
            {formatTooltipTimestamp(hoverPoint.date)}
          </span>
          <div className="flex gap-3">
            <span className="text-foreground/60">
              O <span className="font-medium text-foreground">{formatPrice(hoverPoint.open)}</span>
            </span>
            <span className="text-foreground/60">
              H <span className="font-medium text-foreground">{formatPrice(hoverPoint.high)}</span>
            </span>
            <span className="text-foreground/60">
              L <span className="font-medium text-foreground">{formatPrice(hoverPoint.low)}</span>
            </span>
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
  );
}

export default function HomePage() {
  const [ticker, setTicker] = useState("");
  const [activeTicker, setActiveTicker] = useState<string | null>(null);
  const [data, setData] = useState<StockData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [range, setRange] = useState<Range>("1D");
  const [interval, setChartInterval] = useState<Interval>("5min");
  const [chartType, setChartType] = useState<ChartType>("line");
  const [priceScaleMode, setPriceScaleMode] = useState<PriceScaleMode>("free");

  const [history, setHistory] = useState<HistoryPoint[] | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const [isExpanded, setIsExpanded] = useState(false);

  async function handleSearch() {
    const symbol = ticker.trim();
    if (!symbol) return;

    setLoading(true);
    setError(null);
    setData(null);
    setActiveTicker(null);
    setHistory(null);
    setHistoryError(null);

    try {
      const res = await fetch(`/api/stock?ticker=${encodeURIComponent(symbol)}`);
      const body = await res.json();

      if (!res.ok) {
        setError(body.error ?? "Something went wrong");
        return;
      }

      setData(body);
      setActiveTicker(symbol);
    } catch {
      setError("Failed to fetch stock data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!activeTicker) return;

    let cancelled = false;

    async function loadHistory() {
      setHistoryError(null);

      try {
        const res = await fetch(
          `/api/stock/history?ticker=${encodeURIComponent(
            activeTicker!
          )}&interval=${interval}&range=${range}`
        );
        const body = await res.json();

        if (cancelled) return;

        if (!res.ok) {
          setHistory(null);
          setHistoryError(
            body.error ?? "Chart data not available on the free plan"
          );
          return;
        }

        setHistory(body.history);
      } catch {
        if (!cancelled) {
          setHistory(null);
          setHistoryError("Chart data not available on the free plan");
        }
      }
    }

    const timer = setTimeout(loadHistory, 500);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [activeTicker, interval, range]);

  useEffect(() => {
    if (!isExpanded) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setIsExpanded(false);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isExpanded]);

  return (
    <main className="flex flex-1 flex-col items-center gap-6 p-8 pt-16">
      <h1 className="text-3xl font-bold text-foreground">
        My Finance Dashboard
      </h1>

      <div className="flex w-full max-w-sm gap-2">
        <input
          type="text"
          value={ticker}
          onChange={(e) => setTicker(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          placeholder="e.g. AAPL"
          className="flex-1 rounded-md border border-black/10 bg-transparent px-3 py-2 text-sm outline-none focus:border-black/30 dark:border-white/15 dark:focus:border-white/30"
        />
        <button
          onClick={handleSearch}
          disabled={loading}
          className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "Searching…" : "Search"}
        </button>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      {data && (
        <div className="w-full max-w-sm rounded-md border border-black/10 p-4 text-sm dark:border-white/15">
          <h2 className="mb-3 flex items-center justify-between text-lg font-semibold text-foreground">
            <span>{data.ticker}</span>
            <PercentChangeBadge value={data.percentChange} />
          </h2>
          <dl className="grid grid-cols-2 gap-y-2">
            <dt className="text-foreground/60">Close</dt>
            <dd className="text-right">{formatPrice(data.close)}</dd>
            <dt className="text-foreground/60">Open</dt>
            <dd className="text-right">{formatPrice(data.open)}</dd>
            <dt className="text-foreground/60">High</dt>
            <dd className="text-right">{formatPrice(data.high)}</dd>
            <dt className="text-foreground/60">Low</dt>
            <dd className="text-right">{formatPrice(data.low)}</dd>
          </dl>
        </div>
      )}

      {data && (
        <div
          className={
            isExpanded
              ? "fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
              : "w-full max-w-xl"
          }
          onClick={isExpanded ? () => setIsExpanded(false) : undefined}
        >
          <div
            className={
              isExpanded
                ? "flex h-[90vh] w-[90vw] flex-col rounded-md border border-black/10 bg-background p-4 text-sm shadow-xl dark:border-white/15"
                : "flex w-full flex-col rounded-md border border-black/10 p-4 text-sm dark:border-white/15"
            }
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-foreground">
                {data.ticker}
              </h2>
              <div className="flex items-center gap-1">
                <PillButton
                  active={chartType === "line"}
                  onClick={() => setChartType("line")}
                >
                  Line
                </PillButton>
                <PillButton
                  active={chartType === "candlestick"}
                  onClick={() => setChartType("candlestick")}
                >
                  Candlestick
                </PillButton>
                <span className="mx-1 h-4 w-px bg-black/10 dark:bg-white/15" />
                <PillButton
                  active={priceScaleMode === "free"}
                  onClick={() => setPriceScaleMode("free")}
                >
                  Free
                </PillButton>
                <PillButton
                  active={priceScaleMode === "locked"}
                  onClick={() => setPriceScaleMode("locked")}
                >
                  Locked
                </PillButton>
                <button
                  onClick={() => setIsExpanded((v) => !v)}
                  aria-label={isExpanded ? "Close fullscreen" : "Expand chart"}
                  className="rounded-md border border-black/10 px-2 py-1 text-foreground/60 hover:text-foreground dark:border-white/15"
                >
                  {isExpanded ? "✕" : "⤢"}
                </button>
              </div>
            </div>

            <div className="mb-3 flex flex-wrap items-center gap-3">
              <div className="flex gap-1">
                {RANGES.map((r) => (
                  <PillButton
                    key={r.value}
                    active={range === r.value}
                    onClick={() => setRange(r.value)}
                  >
                    {r.label}
                  </PillButton>
                ))}
              </div>
              {isExpanded && (
                <div className="flex gap-1">
                  {INTERVALS.map((i) => (
                    <PillButton
                      key={i.value}
                      active={interval === i.value}
                      onClick={() => setChartInterval(i.value)}
                    >
                      {i.label}
                    </PillButton>
                  ))}
                </div>
              )}
            </div>

            {historyError && (
              <p className="text-foreground/60">{historyError}</p>
            )}

            <div className={isExpanded ? "min-h-0 flex-1" : "h-64 w-full"}>
              {history && (
                <StockChart
                  history={history}
                  chartType={chartType}
                  range={range}
                  interval={interval}
                  priceScaleMode={priceScaleMode}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
