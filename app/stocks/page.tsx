"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Lock, LockOpen, BarChart3, Layers, Crown, Calculator } from "lucide-react";
import WatchlistStar from "@/components/WatchlistStar";
import RevealOnScroll from "@/components/RevealOnScroll";
import { cardClass } from "@/lib/cardStyles";
import { SCROLLBAR_THIN_CLASS } from "@/lib/scrollbarStyles";
import StocksHeaderBackground from "@/components/stocks/StocksHeaderBackground";
import FeaturedTickersSection, {
  type FeaturedTicker,
} from "@/components/stocks/FeaturedTickersSection";
import EmbeddedWatchlistSection from "@/components/stocks/EmbeddedWatchlistSection";
import StockNewsSection from "@/components/stocks/StockNewsSection";
import StockCatalogSection from "@/components/stocks/StockCatalogSection";
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

// Loaded on demand instead of statically imported — each of these backs
// exactly one non-default tab (Financials/Valuation/Earnings/Ownership),
// so a visit that never leaves the default Overview tab (most visits, in
// practice) previously still paid for all seven of their bundles up
// front, including recharts (pulled in by EarningsCard, FinancialsCard,
// and DividendsCard) even though nothing on Overview uses it. Each now
// only loads the moment its own tab is actually opened.
function DynamicCardLoading() {
  return <div className="h-40 w-full animate-pulse rounded-md bg-foreground/10" />;
}
const EarningsCard = dynamic(() => import("@/components/stocks/EarningsCard"), {
  loading: DynamicCardLoading,
});
const AnalystViewCard = dynamic(() => import("@/components/stocks/AnalystViewCard"), {
  loading: DynamicCardLoading,
});
const InsiderActivityCard = dynamic(() => import("@/components/stocks/InsiderActivityCard"), {
  loading: DynamicCardLoading,
});
const NotableHoldersCard = dynamic(() => import("@/components/stocks/NotableHoldersCard"), {
  loading: DynamicCardLoading,
});
const DividendsCard = dynamic(() => import("@/components/stocks/DividendsCard"), {
  loading: DynamicCardLoading,
});
const PeerComparisonCard = dynamic(() => import("@/components/stocks/PeerComparisonCard"), {
  loading: DynamicCardLoading,
});
const FinancialsCard = dynamic(() => import("@/components/stocks/FinancialsCard"), {
  loading: DynamicCardLoading,
});

// Stable module-level references — FeaturedTickersSection re-fetches
// whenever its `tickers` prop identity changes, so these must never be
// recreated inline inside the component.
const ETF_TICKERS: FeaturedTicker[] = [
  { symbol: "SPY", name: "SPDR S&P 500" },
  { symbol: "QQQ", name: "Invesco QQQ (Nasdaq-100)" },
  { symbol: "DIA", name: "SPDR Dow Jones" },
  { symbol: "VTI", name: "Vanguard Total Market" },
  { symbol: "IWM", name: "iShares Russell 2000" },
];

const MAG7_TICKERS: FeaturedTicker[] = [
  { symbol: "AAPL", name: "Apple" },
  { symbol: "MSFT", name: "Microsoft" },
  { symbol: "GOOGL", name: "Alphabet" },
  { symbol: "AMZN", name: "Amazon" },
  { symbol: "NVDA", name: "NVIDIA" },
  { symbol: "META", name: "Meta Platforms" },
  { symbol: "TSLA", name: "Tesla" },
];

const STAGGER_MS = 60;

// A one-shot, silent background retry after a failed quote fetch — not a
// repeating poll, since a sustained outage shouldn't turn into an
// indefinite retry storm (a manual "Retry" button covers that case).
// Deliberately past lib/finnhubQuoteCache.ts's own 60s FAILURE_BACKOFF_MS
// so this retry actually attempts a fresh upstream call instead of
// immediately hitting that same backoff and getting nothing new.
const QUOTE_RETRY_DELAY_MS = 65_000;

// ---------------------------------------------------------------------
// Banner
// ---------------------------------------------------------------------

function StocksBanner() {
  return (
    <div className="relative w-full overflow-hidden border-b border-white/10" style={{ height: 176 }}>
      <StocksHeaderBackground />

      <div className="relative z-10 flex h-full flex-col items-center justify-center gap-2 px-4 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">Stocks</h1>
        <p className="text-sm text-white/50">
          Real-time quotes, charts, and research for public companies
        </p>
      </div>
    </div>
  );
}

type Session = "pre-market" | "regular" | "post-market" | null;

type MarketStatus = {
  session: Session;
  isOpen: boolean;
};

type ExtendedHours = {
  price: number;
  change: number;
  percentChange: number;
  regularClose: number;
  regularChange: number;
  regularPercentChange: number;
};

type StockData = {
  ticker: string;
  close: number;
  open: number;
  high: number;
  low: number;
  previousClose: number;
  percentChange: number;
  change: number;
  timestamp: string | null;
  marketStatus: MarketStatus | null;
  extendedHours: ExtendedHours | null;
  // True when Finnhub was rate-limited/down and this is the last known-good
  // quote instead of a live one — see lib/finnhubQuoteCache.ts.
  stale: boolean;
};

type Fundamentals = {
  eps: string;
  peRatio: string;
  marketCap: string;
  dividendYield: string;
  week52Range: string;
};

type Suggestion = {
  symbol: string;
  description: string;
};

type RecommendationBreakdown = {
  period: string | null;
  strongBuy: number;
  buy: number;
  hold: number;
  sell: number;
  strongSell: number;
};

type Overview = {
  ticker: string;
  name: string;
  industry: string;
  description?: string;
  ceo?: string;
  employeeCount?: number;
  headquarters?: string;
  // Stock's IPO date, not the company's founding date — see
  // lib/fmp.ts's FmpProfile.ipoDate comment for why no "Founded" field
  // exists. Always label this "IPO Date" wherever it's rendered.
  ipoDate?: string;
  rating: number | null;
  ratingLabel: string;
  recommendationBreakdown: RecommendationBreakdown | null;
  previousRating: number | null;
  previousPeriod: string | null;
  logo: string | null;
  exchange: string | null;
  weburl: string | null;
  currency: string | null;
};

const SESSION_LABELS: Record<NonNullable<Session>, { label: string; dot: string; pulse: boolean }> = {
  "pre-market": { label: "Pre-Market", dot: "bg-amber-500", pulse: false },
  "regular": { label: "Market Open", dot: "bg-green-500", pulse: true },
  "post-market": { label: "After Hours", dot: "bg-amber-500", pulse: false },
};

function MarketStatusPill({ status }: { status: MarketStatus | null }) {
  if (!status) return null;
  const entry = status.session ? SESSION_LABELS[status.session] : null;
  const label = entry?.label ?? "Market Closed";
  const dot = entry?.dot ?? "bg-foreground/30";

  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-foreground/5 px-2 py-0.5 text-xs font-medium text-foreground/70">
      <span className={`h-1.5 w-1.5 rounded-full ${dot} ${entry?.pulse ? "animate-pulse" : ""}`} />
      {label}
    </span>
  );
}

function formatUpdatedTime(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const formatted = date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
  });
  return `Updated ${formatted} ET`;
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-foreground/50">{label}</span>
      <span className="text-lg font-semibold text-foreground">{value}</span>
    </div>
  );
}

// The blue accent (cardClass's "blue" variant) matches the page's ETF
// cards and its other interactive chrome — a subtle gradient/glow tinge
// rather than a flat neutral card, the same visual language crypto's
// GlobalMarketStats/SectorPerformance tiles use for their own stat rows.
function KeyStatsCard({ ticker, fundamentals }: { ticker: string; fundamentals: Fundamentals | null }) {
  return (
    <div className={cardClass("blue", { extra: "flex w-full flex-col gap-3 p-4 text-sm" })}>
      <div className="flex items-center gap-2">
        <BarChart3 size={18} className="text-blue-400" />
        <h2 className="text-lg font-semibold text-foreground">{ticker} Key Stats</h2>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatTile label="EPS" value={fundamentals?.eps ?? "N/A"} />
        <StatTile label="P/E Ratio" value={fundamentals?.peRatio ?? "N/A"} />
        <StatTile label="Market Cap" value={fundamentals?.marketCap ?? "N/A"} />
        <StatTile label="Dividend Yield" value={fundamentals?.dividendYield ?? "N/A"} />
        <StatTile label="52-Week Range" value={fundamentals?.week52Range ?? "N/A"} />
      </div>
    </div>
  );
}

type TabKey = "overview" | "financials" | "valuation" | "earnings" | "ownership" | "news";

const TAB_DEFS: Array<{ key: TabKey; label: string }> = [
  { key: "overview", label: "Overview" },
  { key: "financials", label: "Financials" },
  { key: "valuation", label: "Valuation" },
  { key: "earnings", label: "Earnings" },
  { key: "ownership", label: "Ownership" },
  { key: "news", label: "News" },
];

const VALID_TAB_KEYS: TabKey[] = TAB_DEFS.map((tab) => tab.key);

function isValidTabKey(value: string | null): value is TabKey {
  return value !== null && (VALID_TAB_KEYS as string[]).includes(value);
}

function TabBar({ active, onSelect }: { active: TabKey; onSelect: (tab: TabKey) => void }) {
  return (
    <div className="flex w-full flex-wrap gap-1 border-b border-black/10 pb-2 dark:border-white/15">
      {TAB_DEFS.map((tab) => (
        <button
          key={tab.key}
          type="button"
          onClick={() => onSelect(tab.key)}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-all duration-200 ease-out active:scale-95 ${
            active === tab.key
              ? "bg-blue-500 text-white"
              : "text-foreground/60 hover:bg-foreground/5 hover:text-foreground"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

// Mount-triggered fade + slight upward slide — the same technique
// components/WatchlistCard.tsx uses for its add/remove animation, just
// applied on every mount rather than gated on scroll visibility (tab
// content is already on-screen the moment a tab is clicked, so a
// scroll-triggered reveal like RevealOnScroll would never actually fire).
// The parent remounts this (via `key={activeTab}`) on every tab switch,
// which is what replays the animation each time.
function TabPanel({ children }: { children: React.ReactNode }) {
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setEntered(true), 0);
    return () => clearTimeout(id);
  }, []);

  return (
    <div
      className={`flex w-full flex-col items-center gap-10 transition-all duration-300 ease-out ${
        entered ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
      }`}
    >
      {children}
    </div>
  );
}

// A one-shot left-to-right "wipe" reveal for the price chart on a genuinely
// new ticker load (the parent remounts this via `key={activeTicker}`, not
// on every range/interval switch within the same ticker) — lightweight-
// charts has no native progressive line-draw, so this fakes it with a
// clip-path transition on the chart's own container instead.
function ChartRevealWrapper({ children }: { children: React.ReactNode }) {
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setRevealed(true), 0);
    return () => clearTimeout(id);
  }, []);

  return (
    <div
      className="h-full w-full transition-[clip-path] duration-[900ms] ease-out"
      style={{ clipPath: revealed ? "inset(0 0% 0 0)" : "inset(0 100% 0 0)" }}
    >
      {children}
    </div>
  );
}

function StocksPageInner() {
  const searchParams = useSearchParams();
  // Lazy-initialized from the URL so a deep link (e.g. from the
  // screener's result rows) can pre-fill the search box without an
  // extra effect to sync it in after mount.
  const [ticker, setTicker] = useState(() => searchParams.get("ticker") ?? "");
  const [activeTicker, setActiveTicker] = useState<string | null>(null);
  // Mirrors `activeTicker`, updated synchronously (not via an effect) so
  // the delayed quote retry below can tell whether it's still relevant by
  // the time it fires, rather than clobbering a since-changed search with
  // a stale result.
  const activeTickerRef = useRef<string | null>(null);
  const quoteRetryTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [data, setData] = useState<StockData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [range, setRange] = useState<Range>("1D");
  const [interval, setChartInterval] = useState<Interval>("5min");
  const [chartType, setChartType] = useState<ChartType>("line");
  const [locked, setLocked] = useState(false);
  const [showVolume, setShowVolume] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const [compareHistory, setCompareHistory] = useState<HistoryPoint[] | null>(null);

  const [history, setHistory] = useState<HistoryPoint[] | null>(null);
  // Bumped only on a genuinely fresh history load (new ticker/range/
  // interval), never on an infinite-scroll prepend — lets the chart tell
  // the two apart unambiguously instead of heuristically comparing dates
  // (which can false-positive when two different ranges happen to share
  // an end date and coincidentally align at the computed offset index).
  const [historyGeneration, setHistoryGeneration] = useState(0);
  // Only ever a clean, pre-sanitized message from the server (see
  // app/api/stock/history/route.ts) — never raw provider/rate-limit text —
  // and only set when there's truly no chart to show at all. A fallback
  // (daily-interval retry) or stale (cached-from-earlier) response still
  // populates `history` normally; those are surfaced via the two flags
  // below as an inline notice, not as this blocking error state.
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyFallbackApplied, setHistoryFallbackApplied] = useState(false);
  const [historyStaleFetchedAt, setHistoryStaleFetchedAt] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMoreHistory, setHasMoreHistory] = useState(true);
  const loadingMoreRef = useRef(false);

  const [fundamentals, setFundamentals] = useState<Fundamentals | null>(null);
  const [overview, setOverview] = useState<Overview | null>(null);
  // Lazy-initialized from the URL (e.g. an Earnings Calendar row linking
  // to /stocks?ticker=X&tab=earnings) so a click from a context-specific
  // screen lands directly on the relevant tab instead of the default
  // Overview — same "pre-fill from the deep link, no extra effect needed"
  // reasoning as `ticker`'s own lazy init just above.
  const [activeTab, setActiveTab] = useState<TabKey>(() => {
    const urlTab = searchParams.get("tab");
    return isValidTabKey(urlTab) ? urlTab : "overview";
  });

  const [isExpanded, setIsExpanded] = useState(false);
  const [hoveredPoint, setHoveredPoint] = useState<HistoryPoint | null>(null);

  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  // Also true on the very first render when arriving via a ?ticker= deep
  // link, so the suggestions-dropdown effect below doesn't fire for the
  // pre-filled value before the initial auto-search effect runs.
  const skipNextSuggestionFetchRef = useRef(searchParams.get("ticker") !== null);

  // The ticker string every tab/card below actually needs — `data.ticker`
  // (the server-resolved symbol, e.g. "google" -> "GOOGL") when the quote
  // fetch succeeded, falling back to `activeTicker` (the raw requested
  // symbol) when it hasn't/didn't, so the page shell and every other card
  // (Financials, Dividends, Earnings, etc. — none of which need the quote
  // itself) still render correctly even when the price/chart card
  // couldn't load.
  const resolvedTicker = data?.ticker ?? activeTicker;

  // Refetches just the quote — used both by handleSearch's own first
  // attempt and by the background/manual retry below, without re-running
  // the fundamentals/overview fetches those don't need to repeat.
  async function fetchQuote(symbol: string): Promise<boolean> {
    try {
      const res = await fetch(`/api/stock?ticker=${encodeURIComponent(symbol)}`);
      const body = await res.json();

      if (!res.ok) {
        // Deliberately not `body.error` verbatim — that's a raw,
        // provider-naming diagnostic string meant for server logs (still
        // logged there), not something to show a user. Matches this
        // app's established news-feed convention: a clear, generic
        // "temporarily unavailable" notice instead of a raw upstream
        // error, regardless of the underlying reason.
        setError(
          `Live price data for ${symbol.toUpperCase()} is temporarily unavailable — this can happen for less-frequently viewed tickers. Retrying shortly.`
        );
        return false;
      }

      setData(body);
      setError(null);
      return true;
    } catch {
      setError(`Live price data for ${symbol.toUpperCase()} is temporarily unavailable. Retrying shortly.`);
      return false;
    }
  }

  async function handleSearch(overrideSymbol?: string) {
    const symbol = (overrideSymbol ?? ticker).trim();
    if (!symbol) return;

    if (quoteRetryTimeoutRef.current) {
      clearTimeout(quoteRetryTimeoutRef.current);
      quoteRetryTimeoutRef.current = undefined;
    }

    setShowSuggestions(false);
    setLoading(true);
    setError(null);
    setData(null);
    // Set immediately (not only on a successful quote) so the
    // ticker-specific page shell — tabs, Financials, Dividends, Earnings,
    // etc., none of which depend on the quote itself — always renders for
    // a requested ticker rather than silently falling back to the generic
    // browse view whenever the price/chart card's own fetch fails.
    activeTickerRef.current = symbol;
    setActiveTicker(symbol);
    setHistory(null);
    setHistoryError(null);
    setHistoryFallbackApplied(false);
    setHistoryStaleFetchedAt(null);
    setFundamentals(null);
    setOverview(null);

    const quoteOk = await fetchQuote(symbol);
    setLoading(false);

    if (!quoteOk) {
      quoteRetryTimeoutRef.current = setTimeout(() => {
        if (activeTickerRef.current === symbol) fetchQuote(symbol);
      }, QUOTE_RETRY_DELAY_MS);
    }

    // Independent data sources — always attempted regardless of whether
    // the primary quote succeeded, so a Finnhub quote hiccup for this
    // ticker doesn't also hide financials/analyst data that fetches fine.
    const fallback: Fundamentals = {
      eps: "N/A",
      peRatio: "N/A",
      marketCap: "N/A",
      dividendYield: "N/A",
      week52Range: "N/A",
    };
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
      recommendationBreakdown: null,
      previousRating: null,
      previousPeriod: null,
      logo: null,
      exchange: null,
      weburl: null,
      currency: null,
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

  useEffect(() => {
    return () => {
      if (quoteRetryTimeoutRef.current) clearTimeout(quoteRetryTimeoutRef.current);
    };
  }, []);

  // Reacts to the ?ticker= URL param rather than only firing once on
  // mount, so clicking an in-page <Link href="/stocks?ticker=X"> (ETF /
  // Mag 7 / watchlist / catalog cards) re-triggers a search even though
  // Next.js doesn't remount this page component for a same-route
  // navigation. Guarded on activeTicker so it doesn't refire for a
  // ticker that's already loaded (e.g. the URL settling after our own
  // handleSearch, or clicking a card for the already-active symbol).
  useEffect(() => {
    const urlTicker = searchParams.get("ticker");
    if (!urlTicker || urlTicker === activeTicker) return;

    async function syncFromUrl() {
      skipNextSuggestionFetchRef.current = true;
      setTicker(urlTicker!);
      await handleSearch(urlTicker!);
    }

    syncFromUrl();
    // handleSearch/activeTicker are intentionally omitted: only the URL
    // param itself should retrigger this effect, not every re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

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
          // Always a clean, server-sanitized message (see
          // app/api/stock/history/route.ts) — reached only when there's
          // truly no fallback or cached chart left to show at all.
          setHistory(null);
          setHistoryFallbackApplied(false);
          setHistoryStaleFetchedAt(null);
          setHistoryError(body.error ?? "Chart data temporarily unavailable");
          return;
        }

        setHistory(body.history);
        setHistoryFallbackApplied(Boolean(body.fallbackApplied));
        setHistoryStaleFetchedAt(body.staleFetchedAt ?? null);
        setHistoryGeneration((g) => g + 1);
        setHasMoreHistory(true);
      } catch {
        if (!cancelled) {
          setHistory(null);
          setHistoryFallbackApplied(false);
          setHistoryStaleFetchedAt(null);
          setHistoryError("Chart temporarily unavailable");
        }
      }
    }

    const timer = setTimeout(loadHistory, 500);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [activeTicker, interval, range]);

  // Fetches the comparison line's own history (same range/interval as the
  // primary chart) only while comparison mode is actually toggled on —
  // comparing a ticker to itself would be meaningless, so SPY is skipped
  // when it's already the active ticker.
  useEffect(() => {
    if (!showComparison || !activeTicker || activeTicker === "SPY") {
      function clearCompareHistory() {
        setCompareHistory(null);
      }
      clearCompareHistory();
      return;
    }

    let cancelled = false;

    async function loadCompareHistory() {
      try {
        const res = await fetch(`/api/stock/history?ticker=SPY&interval=${interval}&range=${range}`);
        const body = await res.json();
        if (cancelled) return;
        setCompareHistory(res.ok && Array.isArray(body.history) ? body.history : null);
      } catch {
        if (!cancelled) setCompareHistory(null);
      }
    }

    loadCompareHistory();
    return () => {
      cancelled = true;
    };
  }, [showComparison, activeTicker, interval, range]);

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
        ? data.change
        : 0;
  const displayPercentChange =
    activePoint && periodStartPrice
      ? (displayDollarChange / periodStartPrice) * 100
      : data?.percentChange ?? 0;

  return (
    <main className="flex flex-1 flex-col items-center gap-10 pb-10">
      <StocksBanner />

      <div className="flex w-full max-w-6xl flex-col gap-10 px-8">
        <RevealOnScroll className="flex w-full flex-col items-center gap-6">
          <div className="flex w-full max-w-sm gap-2">
            <div ref={searchContainerRef} className="relative flex-1">
              <input
                type="text"
                value={ticker}
                onChange={(e) => setTicker(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                placeholder="Search for Stock or Ticker Symbol"
                className="w-full rounded-md border border-black/10 bg-transparent px-3 py-2 text-sm outline-none transition-colors duration-200 ease-out focus:border-blue-400/50 dark:border-white/15 dark:focus:border-blue-400/50"
              />
              {showSuggestions && suggestions.length > 0 && ticker.trim().length >= 2 && (
                <ul className={`absolute left-0 right-0 top-full z-20 mt-1 max-h-72 overflow-auto rounded-md border border-black/10 bg-background text-sm shadow-lg dark:border-white/15 ${SCROLLBAR_THIN_CLASS}`}>
                  {suggestions.map((s, index) => (
                    <li key={`${s.symbol}-${index}`}>
                      <button
                        type="button"
                        onClick={() => handleSelectSuggestion(s.symbol)}
                        className="block w-full px-3 py-2 text-left transition-colors duration-150 ease-out hover:bg-foreground/5"
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
              className="rounded-md bg-blue-500 px-4 py-2 text-sm font-medium text-white transition-all duration-200 ease-out hover:bg-blue-600 active:scale-95 disabled:opacity-50"
            >
              {loading ? "Searching…" : "Search"}
            </button>
          </div>

          {/* Only shown when there's no ticker context at all (e.g. a
              network exception before a ticker was even resolved) — once
              a ticker is active, the same message is shown scoped to the
              price/chart card below instead of duplicated up here. */}
          {error && !activeTicker && <p className="text-sm text-red-500">{error}</p>}
        </RevealOnScroll>

        <FeaturedTickersSection
          title="Top ETFs"
          subtitle="Broad market exposure at a glance"
          tickers={ETF_TICKERS}
          accent="blue"
          icon={Layers}
        />

        <FeaturedTickersSection
          title="Mag 7"
          subtitle="The mega-cap tech names moving the market"
          tickers={MAG7_TICKERS}
          accent="indigo"
          icon={Crown}
        />

        {activeTicker && (
          <RevealOnScroll delayMs={STAGGER_MS} className="flex w-full flex-col items-center gap-6">
            <TabBar active={activeTab} onSelect={setActiveTab} />

            <TabPanel key={activeTab}>
              {activeTab === "overview" && (
                <>
                  {overview && (
                    <div className="flex w-full flex-col items-center">
                      <div className={cardClass("neutral", { extra: "w-full max-w-xl p-4 text-sm" })}>
                        <h2 className="mb-1 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-lg font-semibold text-transparent">
                          {overview.name}{" "}
                          <span className="font-normal text-foreground/60">({overview.ticker})</span>
                        </h2>
                        <p className="mb-3 text-foreground/60">{overview.industry}</p>
                        {overview.description && (
                          <p className="mb-3 text-foreground">{overview.description}</p>
                        )}
                        {overview.ipoDate && (
                          <p className="text-xs text-foreground/50">
                            IPO Date: {new Date(`${overview.ipoDate}T00:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {data ? (
                  <div className="flex w-full flex-col items-center">
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
                            ? "flex h-[90vh] w-[90vw] flex-col rounded-lg border border-black/10 bg-background p-4 text-sm shadow-xl dark:border-white/15"
                            : cardClass("neutral", { extra: "flex w-full flex-col p-4 text-sm" })
                        }
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                          <div className="flex min-w-0 items-center gap-2">
                            {overview?.logo && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={overview.logo}
                                alt=""
                                className="h-7 w-7 shrink-0 rounded-full bg-white object-contain p-0.5"
                                onError={(e) => {
                                  e.currentTarget.style.display = "none";
                                }}
                              />
                            )}
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <h2 className="text-lg font-semibold text-foreground">
                                  {data.ticker}
                                </h2>
                                <WatchlistStar symbol={data.ticker} name={overview?.name} />
                                <MarketStatusPill status={data.marketStatus} />
                              </div>
                              {overview?.exchange && (
                                <p className="truncate text-xs text-foreground/50">{overview.exchange}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <PillButton accent="blue" active={chartType === "line"} onClick={() => setChartType("line")}>
                              Line
                            </PillButton>
                            <PillButton
                              accent="blue"
                              active={chartType === "candlestick"}
                              onClick={() => setChartType("candlestick")}
                            >
                              Candlestick
                            </PillButton>
                            <span className="mx-1 h-4 w-px bg-black/10 dark:bg-white/15" />
                            <button
                              onClick={() => setLocked((v) => !v)}
                              aria-label={locked ? "Unlock chart panning" : "Lock chart panning"}
                              className="flex h-10 w-10 items-center justify-center rounded-md border border-black/10 text-foreground/60 transition-all duration-200 ease-out hover:border-black/25 hover:text-foreground active:scale-95 dark:border-white/15 dark:hover:border-white/30"
                            >
                              {locked ? <Lock size={14} /> : <LockOpen size={14} />}
                            </button>
                            <button
                              onClick={() => setIsExpanded((v) => !v)}
                              aria-label={isExpanded ? "Close fullscreen" : "Expand chart"}
                              className="flex h-10 w-10 items-center justify-center rounded-md border border-black/10 text-foreground/60 transition-all duration-200 ease-out hover:border-black/25 hover:text-foreground active:scale-95 dark:border-white/15 dark:hover:border-white/30"
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
                                accent="blue"
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
                                  accent="blue"
                                  active={interval === i.value}
                                  onClick={() => setChartInterval(i.value)}
                                >
                                  {i.label}
                                </PillButton>
                              ))}
                            </div>
                          )}
                          <div className="ml-auto flex gap-1">
                            <PillButton accent="blue" active={showVolume} onClick={() => setShowVolume((v) => !v)}>
                              Volume
                            </PillButton>
                            {data.ticker !== "SPY" && (
                              <PillButton
                                accent="blue"
                                active={showComparison}
                                onClick={() => setShowComparison((v) => !v)}
                              >
                                vs S&amp;P 500
                              </PillButton>
                            )}
                          </div>
                        </div>

                        <div className="mb-3 flex flex-col gap-1">
                          <div className="flex flex-wrap items-baseline gap-2">
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
                            {data.stale && (
                              <span
                                className="rounded-sm bg-foreground/10 px-1.5 py-0.5 text-[10px] font-medium uppercase leading-none tracking-wide text-foreground/50"
                                title="Finnhub is temporarily rate-limited/unavailable — showing the last quote we successfully fetched"
                              >
                                Stale
                              </span>
                            )}
                            {formatUpdatedTime(data.timestamp) && (
                              <span className="ml-auto text-xs text-foreground/40">
                                {formatUpdatedTime(data.timestamp)}
                              </span>
                            )}
                          </div>

                          {data.extendedHours && (
                            <div className="flex flex-wrap items-baseline gap-2 text-sm">
                              <span className="text-foreground/50">
                                {data.marketStatus?.session === "pre-market" ? "Pre-market:" : "After hours:"}
                              </span>
                              <span className="font-medium text-foreground">
                                {formatPrice(data.extendedHours.price)}
                              </span>
                              <span className={`text-xs font-medium ${changeColorClass(data.extendedHours.change)}`}>
                                ({formatDollarChange(data.extendedHours.change)})
                              </span>
                              <PercentChangeBadge value={data.extendedHours.percentChange} />
                            </div>
                          )}
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
                          <p className="mb-2 text-sm text-foreground/60">{historyError}</p>
                        )}

                        {!historyError && history && (historyFallbackApplied || historyStaleFetchedAt) && (
                          <p className="mb-2 text-xs text-amber-500/80">
                            {historyStaleFetchedAt
                              ? `Showing the last available chart, from ${formatUpdatedTime(historyStaleFetchedAt)?.replace("Updated ", "") ?? "earlier"}.`
                              : "Intraday data is temporarily unavailable — showing daily data instead."}
                          </p>
                        )}

                        <div className={isExpanded ? "min-h-0 flex-1" : "h-64 w-full"}>
                          {history && (
                            <ChartRevealWrapper key={activeTicker}>
                              <PriceChart
                                history={history}
                                historyGeneration={historyGeneration}
                                chartType={chartType}
                                range={range}
                                interval={interval}
                                locked={locked}
                                isExpanded={isExpanded}
                                loadingMore={loadingMore}
                                showVolume={showVolume}
                                compareHistory={compareHistory}
                                showComparison={showComparison}
                                onNearLeftEdge={loadMoreHistory}
                                onHoverChange={setHoveredPoint}
                              />
                            </ChartRevealWrapper>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  ) : (
                    // Price/chart data specifically failed to load (e.g. a
                    // transient Finnhub rate limit hitting a ticker with no
                    // prior cached quote) — the rest of this ticker's page
                    // (tabs, Financials, Dividends, Earnings, etc.) still
                    // works and renders normally below; only this one card
                    // shows the degraded state, with a background retry
                    // already scheduled (see handleSearch) plus a manual
                    // one here for whenever the user wants it sooner.
                    <div className="flex w-full flex-col items-center">
                      <div className={cardClass("neutral", { extra: "flex w-full max-w-xl flex-col gap-3 p-4 text-sm" })}>
                        <div className="flex items-center gap-2">
                          <h2 className="text-lg font-semibold text-foreground">{resolvedTicker}</h2>
                          <WatchlistStar symbol={resolvedTicker!} name={overview?.name} />
                        </div>
                        <p className="text-foreground/60">
                          {error ?? "Live price data is temporarily unavailable."}
                        </p>
                        <button
                          type="button"
                          onClick={() => fetchQuote(resolvedTicker!)}
                          className="self-start rounded-md border border-black/10 px-3 py-2 text-sm font-medium text-foreground/70 transition-colors duration-200 ease-out hover:border-black/25 hover:text-foreground dark:border-white/15 dark:hover:border-white/30"
                        >
                          Retry
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="w-full max-w-xl">
                    <KeyStatsCard ticker={resolvedTicker!} fundamentals={fundamentals} />
                  </div>
                </>
              )}

              {activeTab === "financials" && (
                <div className="grid w-full max-w-5xl grid-cols-1 gap-4 lg:grid-cols-2">
                  <div className="lg:col-span-2">
                    <FinancialsCard ticker={resolvedTicker!} />
                  </div>
                  <DividendsCard ticker={resolvedTicker!} currentPrice={data?.close ?? null} />
                </div>
              )}

              {activeTab === "valuation" && overview && (
                <div className="flex w-full max-w-5xl flex-col gap-4">
                  <Link
                    href={`/tools/dcf?ticker=${encodeURIComponent(resolvedTicker!)}`}
                    className={cardClass("blue", {
                      interactive: true,
                      extra: "flex items-center gap-3 p-4",
                    })}
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-400/10">
                      <Calculator size={18} className="text-blue-400" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-foreground">
                        Estimate {resolvedTicker}&apos;s intrinsic value with the DCF Calculator
                      </p>
                      <p className="text-xs text-foreground/60">
                        Opens pre-filled with {resolvedTicker}&apos;s reported free cash flow, historical
                        growth trend, and shares outstanding.
                      </p>
                    </div>
                  </Link>

                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <AnalystViewCard
                      ticker={resolvedTicker!}
                      rating={overview.rating}
                      ratingLabel={overview.ratingLabel}
                      currentPrice={data?.close ?? null}
                      recommendationBreakdown={overview.recommendationBreakdown}
                      previousRating={overview.previousRating}
                      previousPeriod={overview.previousPeriod}
                    />
                    <PeerComparisonCard ticker={resolvedTicker!} />
                  </div>
                </div>
              )}

              {activeTab === "earnings" && (
                <div className="w-full max-w-5xl">
                  <EarningsCard ticker={resolvedTicker!} />
                </div>
              )}

              {activeTab === "ownership" && (
                <div className="grid w-full max-w-5xl grid-cols-1 gap-4 lg:grid-cols-2">
                  <InsiderActivityCard ticker={resolvedTicker!} />
                  <NotableHoldersCard ticker={resolvedTicker!} />
                </div>
              )}

              {activeTab === "news" && (
                <div className="w-full max-w-5xl">
                  <StockNewsSection ticker={resolvedTicker!} />
                </div>
              )}
            </TabPanel>
          </RevealOnScroll>
        )}

        <EmbeddedWatchlistSection />

        <StockCatalogSection />

        <RevealOnScroll>
          <StockNewsSection />
        </RevealOnScroll>
      </div>
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
