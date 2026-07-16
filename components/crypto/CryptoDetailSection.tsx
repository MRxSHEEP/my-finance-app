"use client";

import { useEffect, useRef, useState } from "react";
import { Lock, LockOpen } from "lucide-react";
import PriceChart, {
  changeColorClass,
  formatDollarChange,
  formatPrice,
  PercentChangeBadge,
  PillButton,
  RANGES,
  type ChartType,
  type HistoryPoint,
  type Range,
} from "@/components/PriceChart";

interface SearchResult {
  id: string;
  symbol: string;
  name: string;
  marketCapRank: number | null;
}

interface CryptoOverview {
  id: string;
  symbol: string;
  name: string;
  currentPrice: number;
  percentChange24h: number | null;
  marketCap: number;
  totalVolume: number;
  circulatingSupply: number | null;
  ath: number | null;
  athDate: string | null;
  atl: number | null;
  atlDate: string | null;
}

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const compactCurrencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 2,
});

const compactFormatter = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 2,
});

export default function CryptoDetailSection() {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<SearchResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  const [selected, setSelected] = useState<{ id: string; symbol: string; name: string } | null>(
    null
  );
  const [overview, setOverview] = useState<CryptoOverview | null>(null);
  const [history, setHistory] = useState<HistoryPoint[] | null>(null);
  const [historyGeneration, setHistoryGeneration] = useState(0);
  const [range, setRange] = useState<Range>("1M");
  const [chartType, setChartType] = useState<ChartType>("line");
  const [locked, setLocked] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [hoveredPoint, setHoveredPoint] = useState<HistoryPoint | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Debounced search-as-you-type — CoinGecko's free tier has a much
  // stricter rate limit than Finnhub, so this waits longer than the
  // stocks page's own suggestion debounce (300ms) before firing.
  useEffect(() => {
    const trimmed = query.trim();
    let cancelled = false;

    async function search() {
      if (trimmed.length < 2) {
        if (!cancelled) {
          setSuggestions([]);
          setShowSuggestions(false);
        }
        return;
      }

      try {
        const response = await fetch(`/api/crypto/search?q=${encodeURIComponent(trimmed)}`);
        const body = await response.json().catch(() => null);
        if (cancelled) return;

        if (response.ok && Array.isArray(body?.results)) {
          setSuggestions(body.results);
          setShowSuggestions(body.results.length > 0);
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
    }

    const timer = setTimeout(search, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isExpanded) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setIsExpanded(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isExpanded]);

  function handleSelect(result: SearchResult) {
    setSelected({ id: result.id, symbol: result.symbol.toUpperCase(), name: result.name });
    setQuery(`${result.name} (${result.symbol.toUpperCase()})`);
    setShowSuggestions(false);
  }

  // Loads overview + chart history together whenever the selected coin,
  // range, or chart type changes.
  useEffect(() => {
    if (!selected) return;
    const coinId = selected.id;
    let cancelled = false;

    async function load() {
      if (!cancelled) {
        setLoading(true);
        setError(null);
      }

      try {
        const response = await fetch(
          `/api/crypto/detail?id=${encodeURIComponent(coinId)}&range=${range}&chartType=${chartType}`
        );
        if (!response.ok) throw new Error("request failed");
        const body = await response.json();
        if (cancelled) return;

        setOverview(body.overview ?? null);
        const list: HistoryPoint[] = Array.isArray(body.history) ? body.history : [];
        setHistory(list);
        setHistoryGeneration((generation) => generation + 1);
        if (list.length === 0) setError("No chart data available for this range.");
      } catch {
        if (!cancelled) setError("Failed to load data.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [selected, range, chartType]);

  const periodStartPrice = history && history.length > 0 ? history[0].close : null;
  const activePoint =
    hoveredPoint ?? (history && history.length > 0 ? history[history.length - 1] : null);
  const displayPrice = activePoint ? activePoint.close : overview?.currentPrice ?? 0;
  const displayDollarChange =
    activePoint && periodStartPrice !== null ? activePoint.close - periodStartPrice : 0;
  const displayPercentChange =
    activePoint && periodStartPrice
      ? (displayDollarChange / periodStartPrice) * 100
      : overview?.percentChange24h ?? 0;

  return (
    <section className="flex w-full flex-col items-center gap-4">
      <div className="flex w-full max-w-sm gap-2">
        <div ref={searchContainerRef} className="relative flex-1">
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && suggestions.length > 0) handleSelect(suggestions[0]);
            }}
            onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
            placeholder="Search for a coin (e.g. Bitcoin, ETH)"
            className="w-full rounded-md border border-black/10 bg-transparent px-3 py-2 text-sm outline-none focus:border-black/30 dark:border-white/15 dark:focus:border-white/30"
          />
          {showSuggestions && suggestions.length > 0 && (
            <ul className="absolute left-0 right-0 top-full z-20 mt-1 max-h-72 overflow-auto rounded-md border border-black/10 bg-background text-sm shadow-lg dark:border-white/15">
              {suggestions.map((result) => (
                <li key={result.id}>
                  <button
                    type="button"
                    onClick={() => handleSelect(result)}
                    className="block w-full px-3 py-2 text-left hover:bg-foreground/5"
                  >
                    <span className="font-medium text-foreground">{result.name}</span>
                    <span className="text-foreground/60"> ({result.symbol.toUpperCase()})</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      {selected && (
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
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-foreground">
                {selected.name}{" "}
                <span className="font-normal text-foreground/60">({selected.symbol})</span>
              </h2>
              <div className="flex items-center gap-1">
                <PillButton active={chartType === "line"} onClick={() => setChartType("line")}>
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
                  onClick={() => setLocked((value) => !value)}
                  aria-label={locked ? "Unlock chart panning" : "Lock chart panning"}
                  className="rounded-md border border-black/10 p-1.5 text-foreground/60 hover:text-foreground dark:border-white/15"
                >
                  {locked ? <Lock size={14} /> : <LockOpen size={14} />}
                </button>
                <button
                  onClick={() => setIsExpanded((value) => !value)}
                  aria-label={isExpanded ? "Close fullscreen" : "Expand chart"}
                  className="rounded-md border border-black/10 px-2 py-1 text-foreground/60 hover:text-foreground dark:border-white/15"
                >
                  {isExpanded ? "✕" : "⤢"}
                </button>
              </div>
            </div>

            <div className="mb-3 flex gap-1">
              {RANGES.map((r) => (
                <PillButton key={r.value} active={range === r.value} onClick={() => setRange(r.value)}>
                  {r.label}
                </PillButton>
              ))}
            </div>

            <div className="mb-3 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-foreground">{formatPrice(displayPrice)}</span>
              <span
                className={`text-sm font-medium transition-colors duration-200 ${changeColorClass(
                  displayDollarChange
                )}`}
              >
                ({formatDollarChange(displayDollarChange)})
              </span>
              <PercentChangeBadge value={displayPercentChange} />
            </div>

            <div className={isExpanded ? "min-h-0 flex-1" : "h-64 w-full"}>
              {history && history.length > 0 ? (
                <PriceChart
                  history={history}
                  historyGeneration={historyGeneration}
                  chartType={chartType}
                  range={range}
                  interval="1day"
                  locked={locked}
                  isExpanded={isExpanded}
                  loadingMore={false}
                  onNearLeftEdge={() => {}}
                  onHoverChange={setHoveredPoint}
                />
              ) : (
                loading && <div className="h-full w-full animate-pulse rounded bg-foreground/10" />
              )}
            </div>
          </div>
        </div>
      )}

      {selected && overview && (
        <div className="grid w-full max-w-xl grid-cols-2 gap-4 rounded-md border border-black/10 p-4 text-sm dark:border-white/15 sm:grid-cols-3">
          <div>
            <span className="block text-xs text-foreground/50">Market Cap</span>
            <span className="font-semibold text-foreground">
              {compactCurrencyFormatter.format(overview.marketCap)}
            </span>
          </div>
          <div>
            <span className="block text-xs text-foreground/50">24h Volume</span>
            <span className="font-semibold text-foreground">
              {compactCurrencyFormatter.format(overview.totalVolume)}
            </span>
          </div>
          <div>
            <span className="block text-xs text-foreground/50">Circulating Supply</span>
            <span className="font-semibold text-foreground">
              {overview.circulatingSupply !== null
                ? compactFormatter.format(overview.circulatingSupply)
                : "—"}
            </span>
          </div>
          <div>
            <span className="block text-xs text-foreground/50">All-Time High</span>
            <span className="font-semibold text-foreground">
              {overview.ath !== null ? currencyFormatter.format(overview.ath) : "—"}
            </span>
          </div>
          <div>
            <span className="block text-xs text-foreground/50">All-Time Low</span>
            <span className="font-semibold text-foreground">
              {overview.atl !== null ? currencyFormatter.format(overview.atl) : "—"}
            </span>
          </div>
        </div>
      )}
    </section>
  );
}
