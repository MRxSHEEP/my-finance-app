"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Lock, LockOpen } from "lucide-react";
import WatchlistStar from "@/components/WatchlistStar";
import DeepDiveSection from "@/components/stocks/DeepDiveSection";
import PriceChart, {
  changeColorClass,
  DEFAULT_INTERVAL_FOR_RANGE,
  formatDollarChange,
  formatPrice,
  formatVolume,
  INTERVALS,
  PercentChangeBadge,
  PillButton,
  RANGES,
  type ChartType,
  type HistoryPoint,
  type Interval,
  type Range,
} from "@/components/PriceChart";

type StockData = {
  ticker: string;
  close: number;
  open: number;
  high: number;
  low: number;
  percentChange: number;
};

type Fundamentals = {
  eps: string;
  peRatio: string;
  marketCap: string;
};

type Suggestion = {
  symbol: string;
  description: string;
};

type Overview = {
  ticker: string;
  name: string;
  industry: string;
  description?: string;
  rating: number | null;
  ratingLabel: string;
};

function StocksPageInner() {
  const searchParams = useSearchParams();
  // Lazy-initialized from the URL so a deep link (e.g. from the
  // screener's result rows) can pre-fill the search box without an
  // extra effect to sync it in after mount.
  const [ticker, setTicker] = useState(() => searchParams.get("ticker") ?? "");
  const [activeTicker, setActiveTicker] = useState<string | null>(null);
  const [data, setData] = useState<StockData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [range, setRange] = useState<Range>("1D");
  const [interval, setChartInterval] = useState<Interval>("5min");
  const [chartType, setChartType] = useState<ChartType>("line");
  const [locked, setLocked] = useState(false);

  const [history, setHistory] = useState<HistoryPoint[] | null>(null);
  // Bumped only on a genuinely fresh history load (new ticker/range/
  // interval), never on an infinite-scroll prepend — lets the chart tell
  // the two apart unambiguously instead of heuristically comparing dates
  // (which can false-positive when two different ranges happen to share
  // an end date and coincidentally align at the computed offset index).
  const [historyGeneration, setHistoryGeneration] = useState(0);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMoreHistory, setHasMoreHistory] = useState(true);
  const loadingMoreRef = useRef(false);

  const [fundamentals, setFundamentals] = useState<Fundamentals | null>(null);
  const [overview, setOverview] = useState<Overview | null>(null);

  const [isExpanded, setIsExpanded] = useState(false);
  const [hoveredPoint, setHoveredPoint] = useState<HistoryPoint | null>(null);

  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  // Also true on the very first render when arriving via a ?ticker= deep
  // link, so the suggestions-dropdown effect below doesn't fire for the
  // pre-filled value before the initial auto-search effect runs.
  const skipNextSuggestionFetchRef = useRef(searchParams.get("ticker") !== null);

  async function handleSearch(overrideSymbol?: string) {
    const symbol = (overrideSymbol ?? ticker).trim();
    if (!symbol) return;

    setShowSuggestions(false);
    setLoading(true);
    setError(null);
    setData(null);
    setActiveTicker(null);
    setHistory(null);
    setHistoryError(null);
    setFundamentals(null);
    setOverview(null);

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
      return;
    } finally {
      setLoading(false);
    }

    const fallback: Fundamentals = { eps: "N/A", peRatio: "N/A", marketCap: "N/A" };
    try {
      const res = await fetch(
        `/api/stock/fundamentals?ticker=${encodeURIComponent(symbol)}`
      );
      const body = await res.json();
      setFundamentals(res.ok ? body : fallback);
    } catch {
      setFundamentals(fallback);
    }

    const overviewFallback: Overview = {
      ticker: symbol.toUpperCase(),
      name: symbol.toUpperCase(),
      industry: "N/A",
      rating: null,
      ratingLabel: "N/A",
    };
    try {
      const res = await fetch(
        `/api/stock/overview?ticker=${encodeURIComponent(symbol)}`
      );
      const body = await res.json();
      setOverview(res.ok ? body : overviewFallback);
    } catch {
      setOverview(overviewFallback);
    }
  }

  function handleSelectSuggestion(symbol: string) {
    skipNextSuggestionFetchRef.current = true;
    setTicker(symbol);
    setSuggestions([]);
    setShowSuggestions(false);
    handleSearch(symbol);
  }

  const initialTickerRef = useRef(searchParams.get("ticker"));
  useEffect(() => {
    const initial = initialTickerRef.current;
    if (!initial) return;
    initialTickerRef.current = null;
    handleSearch(initial);
    // Runs once on mount to auto-search a ?ticker= deep link; handleSearch
    // is redefined every render but only its current-mount closure matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadMoreHistory() {
    if (!activeTicker || !history || history.length === 0) return;
    if (loadingMoreRef.current || !hasMoreHistory) return;

    loadingMoreRef.current = true;
    setLoadingMore(true);

    const cursor = history[0].date;

    try {
      const res = await fetch(
        `/api/stock/history?ticker=${encodeURIComponent(
          activeTicker
        )}&interval=${interval}&range=${range}&before=${encodeURIComponent(cursor)}`
      );
      const body = await res.json();

      if (!res.ok || !Array.isArray(body.history) || body.history.length === 0) {
        setHasMoreHistory(false);
        return;
      }

      const existingDates = new Set(history.map((point) => point.date));
      const newBars = (body.history as HistoryPoint[]).filter(
        (point) => !existingDates.has(point.date)
      );

      if (newBars.length === 0) {
        setHasMoreHistory(false);
        return;
      }

      setHistory([...newBars, ...history]);
    } catch {
      // Transient failure — the user can keep scrolling and we'll retry
      // the next time they near the edge again.
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
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
        setHistoryGeneration((g) => g + 1);
        setHasMoreHistory(true);
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
    if (skipNextSuggestionFetchRef.current) {
      skipNextSuggestionFetchRef.current = false;
      return;
    }

    const query = ticker.trim();

    if (query.length < 2) {
      return;
    }

    let cancelled = false;

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/stock/suggestions?q=${encodeURIComponent(query)}`
        );
        const body = await res.json();

        if (cancelled) return;

        if (res.ok && Array.isArray(body.suggestions)) {
          setSuggestions(body.suggestions);
          setShowSuggestions(body.suggestions.length > 0);
        } else {
          setSuggestions([]);
          setShowSuggestions(false);
        }
      } catch {
        if (!cancelled) {
          setSuggestions([]);
          setShowSuggestions(false);
        }
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [ticker]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isExpanded) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setIsExpanded(false);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isExpanded]);

  // Drives the big price/%/$ display: defaults to the latest point in the
  // selected period, but follows the crosshair while hovering. The percent
  // and dollar change are always relative to the period's starting price,
  // so they correctly change meaning across 1D/1W/1M/3M/1Y.
  const periodStartPrice = history && history.length > 0 ? history[0].close : null;
  const activePoint =
    hoveredPoint ?? (history && history.length > 0 ? history[history.length - 1] : null);

  const displayPrice = activePoint ? activePoint.close : data?.close ?? 0;
  const displayDollarChange =
    activePoint && periodStartPrice !== null
      ? activePoint.close - periodStartPrice
      : data
        ? data.close - data.open
        : 0;
  const displayPercentChange =
    activePoint && periodStartPrice
      ? (displayDollarChange / periodStartPrice) * 100
      : data?.percentChange ?? 0;

  return (
    <main className="flex flex-1 flex-col items-center gap-6 p-8 pt-16">
      <h1 className="text-3xl font-bold text-foreground">
        Stock Search
      </h1>

      <div className="flex w-full max-w-sm gap-2">
        <div ref={searchContainerRef} className="relative flex-1">
          <input
            type="text"
            value={ticker}
            onChange={(e) => setTicker(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
            placeholder="Search for Stock or Ticker Symbol"
            className="w-full rounded-md border border-black/10 bg-transparent px-3 py-2 text-sm outline-none focus:border-black/30 dark:border-white/15 dark:focus:border-white/30"
          />
          {showSuggestions && suggestions.length > 0 && ticker.trim().length >= 2 && (
            <ul className="absolute left-0 right-0 top-full z-20 mt-1 max-h-72 overflow-auto rounded-md border border-black/10 bg-background text-sm shadow-lg dark:border-white/15">
              {suggestions.map((s, index) => (
                <li key={`${s.symbol}-${index}`}>
                  <button
                    type="button"
                    onClick={() => handleSelectSuggestion(s.symbol)}
                    className="block w-full px-3 py-2 text-left hover:bg-foreground/5"
                  >
                    <span className="font-medium text-foreground">{s.symbol}</span>
                    <span className="text-foreground/60"> — {s.description}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <button
          onClick={() => handleSearch()}
          disabled={loading}
          className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "Searching…" : "Search"}
        </button>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      {data && overview && (
        <div className="w-full max-w-xl rounded-md border border-black/10 p-4 text-sm dark:border-white/15">
          <h2 className="mb-1 text-lg font-semibold text-foreground">
            {overview.name}{" "}
            <span className="font-normal text-foreground/60">({overview.ticker})</span>
          </h2>
          <p className="mb-3 text-foreground/60">{overview.industry}</p>
          {overview.description && (
            <p className="mb-3 text-foreground">{overview.description}</p>
          )}
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
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-foreground">
                  {data.ticker}
                </h2>
                <WatchlistStar symbol={data.ticker} name={overview?.name} />
              </div>
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
                <button
                  onClick={() => setLocked((v) => !v)}
                  aria-label={locked ? "Unlock chart panning" : "Lock chart panning"}
                  className="rounded-md border border-black/10 p-1.5 text-foreground/60 hover:text-foreground dark:border-white/15"
                >
                  {locked ? <Lock size={14} /> : <LockOpen size={14} />}
                </button>
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
                    onClick={() => {
                      setRange(r.value);
                      setChartInterval(DEFAULT_INTERVAL_FOR_RANGE[r.value]);
                    }}
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

            <div className="mb-3 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-foreground">
                {formatPrice(displayPrice)}
              </span>
              <span
                className={`text-sm font-medium transition-colors duration-200 ${changeColorClass(
                  displayDollarChange
                )}`}
              >
                ({formatDollarChange(displayDollarChange)})
              </span>
              <PercentChangeBadge value={displayPercentChange} />
            </div>

            {isExpanded && chartType === "candlestick" && activePoint && (
              <div
                className={`mb-2 font-mono text-xs font-medium ${
                  activePoint.close >= activePoint.open ? "text-green-500" : "text-red-500"
                }`}
              >
                O {formatPrice(activePoint.open)}{"  "}
                H {formatPrice(activePoint.high)}{"  "}
                L {formatPrice(activePoint.low)}{"  "}
                C {formatPrice(activePoint.close)}{"  "}
                <span className="text-foreground/60">
                  V{" "}
                  {activePoint.volume !== undefined
                    ? formatVolume(activePoint.volume)
                    : "—"}
                </span>
              </div>
            )}

            {historyError && (
              <p className="text-foreground/60">{historyError}</p>
            )}

            <div className={isExpanded ? "min-h-0 flex-1" : "h-64 w-full"}>
              {history && (
                <PriceChart
                  history={history}
                  historyGeneration={historyGeneration}
                  chartType={chartType}
                  range={range}
                  interval={interval}
                  locked={locked}
                  isExpanded={isExpanded}
                  loadingMore={loadingMore}
                  onNearLeftEdge={loadMoreHistory}
                  onHoverChange={setHoveredPoint}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {data && (
        <div className="w-full max-w-xl rounded-md border border-black/10 p-4 text-sm dark:border-white/15">
          <h2 className="mb-3 text-lg font-semibold text-foreground">
            {data.ticker}
          </h2>
          <dl className="grid grid-cols-2 gap-y-2">
            <dt className="text-foreground/60">EPS</dt>
            <dd className="text-right">{fundamentals?.eps ?? "N/A"}</dd>
            <dt className="text-foreground/60">P/E Ratio</dt>
            <dd className="text-right">{fundamentals?.peRatio ?? "N/A"}</dd>
            <dt className="text-foreground/60">Market Cap</dt>
            <dd className="text-right">{fundamentals?.marketCap ?? "N/A"}</dd>
          </dl>
        </div>
      )}

      {data && overview && (
        <DeepDiveSection
          ticker={data.ticker}
          rating={overview.rating}
          ratingLabel={overview.ratingLabel}
          currentPrice={data.close}
        />
      )}
    </main>
  );
}

export default function StocksPage() {
  return (
    <Suspense fallback={null}>
      <StocksPageInner />
    </Suspense>
  );
}
