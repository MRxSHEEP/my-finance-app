"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { CalendarClock, ArrowUpRight, ArrowDownRight, BellRing } from "lucide-react";
import RevealOnScroll from "@/components/RevealOnScroll";
import PaginationControls from "@/components/Pagination";
import SectorFilterDropdown, { type SectorFilter } from "@/components/SectorFilterDropdown";
import WatchlistStar from "@/components/WatchlistStar";
import StockLogo from "@/components/stocks/StockLogo";
import { STOCK_CATALOG, type CatalogSector } from "@/lib/stockCatalog";
import { useInViewOnce } from "@/lib/useInViewOnce";

const POLL_INTERVAL_MS = 5 * 60_000;
const PAGE_SIZE = 20;
const STAGGER_MS = 30;
const MAX_STAGGER_MS = 300;

// The earnings calendar is already hard-filtered (server-side, in
// lib/earningsCalendar.ts) to this exact same ~130-ticker catalog, so
// every entry's symbol is guaranteed to have sectors here — reused
// directly rather than plumbing a `sector` field through the earnings
// API. Includes both the primary sector and any secondarySectors (see
// lib/stockCatalog.ts's CatalogEntry) so this filter stays consistent
// with the Stock Catalog's own multi-sector matching — e.g. Alphabet
// filters as both "Technology" and "Artificial Intelligence" here
// exactly as it does there, not just its primary "Communication Services".
const SYMBOL_SECTORS_MAP = new Map<string, CatalogSector[]>(
  STOCK_CATALOG.map((entry) => [
    entry.symbol,
    [entry.sector as CatalogSector, ...((entry.secondarySectors as CatalogSector[] | undefined) ?? [])],
  ])
);

interface EarningsEntry {
  symbol: string;
  name: string;
  date: string; // YYYY-MM-DD
  hour: "bmo" | "amc" | "dmh" | null;
  epsEstimate: number | null;
  epsActual: number | null;
  revenueEstimate: number | null;
  revenueActual: number | null;
  isMag7: boolean;
}

interface EarningsCalendarData {
  entries: EarningsEntry[];
  generatedAt: string;
}

type FilterMode = "thisWeek" | "nextWeek" | "custom";

const compactCurrencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

const inputClassName =
  "rounded-md border border-black/10 bg-transparent px-3 py-2 text-sm outline-none focus:border-black/30 dark:border-white/15 dark:focus:border-white/30";

function todayIsoUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysBetweenIso(dateIso: string, todayIso: string): number {
  const a = new Date(`${dateIso}T00:00:00Z`).getTime();
  const b = new Date(`${todayIso}T00:00:00Z`).getTime();
  return Math.round((a - b) / 86_400_000);
}

function formatEps(value: number | null): string {
  if (value === null) return "—";
  return `${value < 0 ? "-" : ""}$${Math.abs(value).toFixed(2)}`;
}

function formatHour(hour: EarningsEntry["hour"]): string {
  switch (hour) {
    case "bmo":
      return "Before Market Open";
    case "amc":
      return "After Market Close";
    case "dmh":
      return "During Market Hours";
    default:
      return "Time not yet announced";
  }
}

function formatDateHeader(dateIso: string): string {
  return new Date(`${dateIso}T00:00:00Z`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function sortWithinGroup(entries: EarningsEntry[]): EarningsEntry[] {
  return [...entries].sort((a, b) => {
    if (a.isMag7 !== b.isMag7) return a.isMag7 ? -1 : 1;
    return a.symbol.localeCompare(b.symbol);
  });
}

// Chronological pre-sort applied before pagination slices the list — the
// raw Finnhub response is only chunk-ordered (see lib/earningsCalendar.ts),
// not strictly date-sorted overall, so without this a page boundary could
// land in an arbitrary spot rather than a clean date cutoff.
function sortChronologically(entries: EarningsEntry[]): EarningsEntry[] {
  return [...entries].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    if (a.isMag7 !== b.isMag7) return a.isMag7 ? -1 : 1;
    return a.symbol.localeCompare(b.symbol);
  });
}

interface EntryGroup {
  key: string;
  label: string;
  sortRank: number;
  entries: EarningsEntry[];
}

// A running "how many rows came before this group" offset per group, so
// the stagger reveal below reads as one smooth top-to-bottom sweep across
// however many date-header groups a page is split into, rather than
// restarting at each group boundary. A plain reduce (not a variable
// mutated across JSX callback invocations) keeps this a pure derivation.
function withStartOffsets(groups: EntryGroup[]): Array<EntryGroup & { startIndex: number }> {
  let runningTotal = 0;
  return groups.map((group) => {
    const withOffset = { ...group, startIndex: runningTotal };
    runningTotal += group.entries.length;
    return withOffset;
  });
}

// Groups a set of upcoming entries the way the spec describes: Today /
// Tomorrow / This Week (days 2-6) as named buckets, then every date
// beyond that gets its own header. This same function backs both the
// default "This Week" tab (which naturally produces Today/Tomorrow/This
// Week) and the "Next Week"/custom-range tabs, whose entries all fall
// past day 6 and so land on individual date headers automatically. Only
// ever called on one already-paginated page's worth of entries — a group
// label can therefore reappear at the top of the next page if it happens
// to straddle a page boundary, a small, acceptable trade-off for keeping
// pagination itself a simple, predictable 20-rows-per-page contract.
function buildGroups(entries: EarningsEntry[], todayIso: string): EntryGroup[] {
  const map = new Map<string, EntryGroup>();

  for (const entry of entries) {
    const diff = daysBetweenIso(entry.date, todayIso);
    let key: string;
    let label: string;
    let sortRank: number;

    if (diff === 0) {
      key = "today";
      label = "Today";
      sortRank = -2;
    } else if (diff === 1) {
      key = "tomorrow";
      label = "Tomorrow";
      sortRank = -1;
    } else if (diff >= 2 && diff <= 6) {
      key = "this-week";
      label = "This Week";
      sortRank = 0;
    } else {
      key = entry.date;
      label = formatDateHeader(entry.date);
      sortRank = diff;
    }

    if (!map.has(key)) map.set(key, { key, label, sortRank, entries: [] });
    map.get(key)!.entries.push(entry);
  }

  return [...map.values()]
    .sort((a, b) => a.sortRank - b.sortRank)
    .map((group) => ({ ...group, entries: sortWithinGroup(group.entries) }));
}

// A quick "how has this company historically done against estimates"
// trust signal, reusing the exact same /api/stock/earnings endpoint (and
// its 10-minute server-side cache) the stock detail page's own Earnings
// tab already calls — no new data source. Finnhub's free tier caps
// historical quarters at 4 (confirmed live), so this honestly reports
// however many quarters actually came back rather than assuming a fixed
// window like 8. Lazy-loaded via useInViewOnce (same pattern EarningsCard
// itself already uses for its chart) rather than fetching for every row
// on mount — with up to 40 rows on a page, and each of those already
// competing for the same Finnhub account's rate limit via StockLogo's own
// /api/stock/overview calls, only fetching once a row actually scrolls
// into view spreads that load out instead of bursting it all at once.
function TrackRecordBadge({ symbol }: { symbol: string }) {
  const { ref, visible } = useInViewOnce<HTMLSpanElement>();
  const [record, setRecord] = useState<{ beats: number; total: number } | null>(null);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch(`/api/stock/earnings?ticker=${encodeURIComponent(symbol)}`);
        if (!response.ok) return;
        const body = await response.json();
        const quarters: Array<{ actual: number | null; estimate: number | null }> = Array.isArray(
          body?.quarters
        )
          ? body.quarters
          : [];
        const scored = quarters.filter((q) => q.actual !== null && q.estimate !== null);
        if (cancelled || scored.length === 0) return;
        const beats = scored.filter((q) => q.actual! >= q.estimate!).length;
        setRecord({ beats, total: scored.length });
      } catch {
        // Omitted rather than shown broken — matches this app's established
        // "no badge" fallback for supplementary, non-critical data.
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [visible, symbol]);

  return (
    <span ref={ref} className="text-[11px] text-foreground/40">
      {record && record.total > 0 ? `Beat ${record.beats} of last ${record.total} quarters` : ""}
    </span>
  );
}

// The last daily bar strictly before the report date — i.e. the
// pre-earnings close — assuming `history` is in ascending (oldest-first)
// date order, which /api/stock/history's daily bars already are.
function findPreEarningsClose(
  history: Array<{ date: string; close: number }>,
  reportDate: string
): number | null {
  const reportMs = new Date(`${reportDate}T00:00:00Z`).getTime();
  let best: number | null = null;
  for (const bar of history) {
    const barMs = new Date(`${bar.date}T00:00:00Z`).getTime();
    if (barMs >= reportMs) break;
    best = bar.close;
  }
  return best;
}

// "How did the stock actually move after reporting" — the cumulative
// change from the close just before the report to the most recent close,
// not just the EPS beat/miss %. Reuses /api/stock/history (the same
// resilient, throttled-and-cached TwelveData route the stock detail
// chart itself uses) at a 1-month daily range, comfortably covering both
// the report date and today for anything in the Recently Reported window
// (bounded to the last 7 days). Lazy-loaded on scroll-into-view, same
// reasoning as TrackRecordBadge above — this is a second per-row fetch
// on top of that one, so spreading both out over scroll position matters
// even more here.
function PriceReactionBadge({ symbol, reportDate }: { symbol: string; reportDate: string }) {
  const { ref, visible } = useInViewOnce<HTMLSpanElement>();
  const [percent, setPercent] = useState<number | null>(null);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch(
          `/api/stock/history?ticker=${encodeURIComponent(symbol)}&interval=1day&range=1M`
        );
        if (!response.ok) return;
        const body = await response.json();
        const history: Array<{ date: string; close: number }> = Array.isArray(body?.history)
          ? body.history
          : [];
        if (history.length < 2) return;

        const preClose = findPreEarningsClose(history, reportDate);
        const latestClose = history[history.length - 1].close;
        if (cancelled || preClose === null || preClose === 0) return;
        setPercent(((latestClose - preClose) / preClose) * 100);
      } catch {
        // Omitted rather than shown broken.
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [visible, symbol, reportDate]);

  if (percent === null) return <span ref={ref} />;

  const isUp = percent >= 0;
  return (
    <span ref={ref} className={`text-[11px] font-medium ${isUp ? "text-green-500" : "text-red-500"}`}>
      {isUp ? "▲" : "▼"} {isUp ? "+" : ""}
      {percent.toFixed(1)}% since report
    </span>
  );
}

function EarningsRow({
  entry,
  todayIso,
  delayMs = 0,
  watchlisted,
}: {
  entry: EarningsEntry;
  todayIso: string;
  delayMs?: number;
  // Always a definite boolean (defaults to false until the parent's own
  // one-time GET /api/watchlist resolves) — passed straight through as
  // WatchlistStar's `initialSaved`, so up to 40 rows never each fire
  // their own redundant per-instance watchlist fetch. A row that's
  // genuinely saved can flash unstarred for the brief moment before that
  // one parent fetch resolves; a small, acceptable trade-off for avoiding
  // N duplicate requests.
  watchlisted: boolean;
}) {
  const isToday = entry.date === todayIso;
  const reported = entry.epsActual !== null;
  const beat =
    reported && entry.epsEstimate !== null ? entry.epsActual! >= entry.epsEstimate! : null;
  const surprisePercent =
    reported && entry.epsEstimate ? ((entry.epsActual! - entry.epsEstimate!) / Math.abs(entry.epsEstimate!)) * 100 : null;

  return (
    <RevealOnScroll delayMs={delayMs}>
      <Link
        href={`/stocks?ticker=${encodeURIComponent(entry.symbol)}&tab=earnings`}
        className={`flex flex-wrap items-center gap-4 rounded-lg border p-3 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-lg ${
          isToday
            ? "border-amber-500/30 bg-amber-500/5 hover:shadow-amber-400/10"
            : "border-black/10 bg-foreground/[0.02] hover:border-black/20 hover:shadow-black/5 dark:border-white/15 dark:hover:border-white/25 dark:hover:shadow-white/5"
        }`}
      >
        <StockLogo symbol={entry.symbol} size={36} />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-foreground">{entry.symbol}</span>
            <span className="truncate text-sm text-foreground/60">{entry.name}</span>
            {isToday && (
              <span className="flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-500">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
                Reporting Today
              </span>
            )}
          </div>
          <p className="text-xs text-foreground/50">{formatHour(entry.hour)}</p>
          <TrackRecordBadge symbol={entry.symbol} />
        </div>

        {/* Clicking the star must not also trigger the row's own Link
            navigation. stopPropagation alone isn't enough — the row is a
            real <a href>, so without preventDefault too, the browser's
            native "follow this link" action still fires regardless of
            whether the React click event kept bubbling (confirmed live:
            without preventDefault, clicking the star still hard-navigated
            to the stock page). Both together fully suppress it. */}
        <div
          className="shrink-0"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
        >
          <WatchlistStar symbol={entry.symbol} name={entry.name} initialSaved={watchlisted} />
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1 text-sm">
          {beat !== null && (
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${
                beat
                  ? "bg-gradient-to-b from-green-400/25 to-green-500/5 text-green-400 ring-green-400/30"
                  : "bg-gradient-to-b from-red-400/25 to-red-500/5 text-red-400 ring-red-400/30"
              }`}
            >
              {beat ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
              {beat ? "Beat" : "Miss"}
              {surprisePercent !== null &&
                ` ${surprisePercent >= 0 ? "+" : ""}${surprisePercent.toFixed(1)}%`}
            </span>
          )}
          {reported ? (
            <>
              <span className="text-foreground/80">
                {formatEps(entry.epsActual)} vs {formatEps(entry.epsEstimate)} est.
              </span>
              {entry.revenueActual !== null && entry.revenueEstimate !== null && (
                <span className="text-xs text-foreground/50">
                  Rev. {compactCurrencyFormatter.format(entry.revenueActual)} vs{" "}
                  {compactCurrencyFormatter.format(entry.revenueEstimate)} est.
                </span>
              )}
              <PriceReactionBadge symbol={entry.symbol} reportDate={entry.date} />
            </>
          ) : (
            <>
              <span className="text-foreground/80">EPS est. {formatEps(entry.epsEstimate)}</span>
              {entry.revenueEstimate !== null && (
                <span className="text-xs text-foreground/50">
                  Rev. est. {compactCurrencyFormatter.format(entry.revenueEstimate)}
                </span>
              )}
            </>
          )}
        </div>
      </Link>
    </RevealOnScroll>
  );
}

function EarningsRowSkeleton() {
  return (
    <div className="flex items-center gap-4 rounded-lg border border-black/10 p-3 dark:border-white/15">
      <div className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-foreground/10" />
      <div className="h-4 flex-1 animate-pulse rounded bg-foreground/10" />
      <div className="h-8 w-24 shrink-0 animate-pulse rounded bg-foreground/10" />
    </div>
  );
}

// Surfaces upcoming (not-yet-reported) earnings for tickers on the user's
// watchlist, always first on the page and never sector-filtered — this
// doubles as the "earnings alert" feature: rather than building a
// separate persisted/cross-session notification system (no such
// infrastructure actually exists yet in this app — the Trackers plan's
// TrackerNotification model is an unused schema shell with zero
// supporting code, and it's tightly coupled to Trackers' own
// TrackedEntity model rather than something Earnings could reuse as-is),
// this live, always-current view of "does anything I'm watching report
// soon" satisfies the same practical need every time the page loads, with
// no new schema/migration required. A dedicated, persisted alert system
// (a notification bell, mark-as-read, etc.) would be a separate, larger
// feature if wanted later.
function WatchlistEarningsSection({
  entries,
  todayIso,
  watchlistSymbols,
}: {
  entries: EarningsEntry[];
  todayIso: string;
  watchlistSymbols: Set<string>;
}) {
  const upcoming = useMemo(
    () =>
      entries
        .filter(
          (entry) =>
            entry.epsActual === null &&
            watchlistSymbols.has(entry.symbol) &&
            daysBetweenIso(entry.date, todayIso) >= 0
        )
        .sort((a, b) => daysBetweenIso(a.date, todayIso) - daysBetweenIso(b.date, todayIso)),
    [entries, todayIso, watchlistSymbols]
  );

  if (watchlistSymbols.size === 0 || upcoming.length === 0) return null;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-indigo-400/20 bg-indigo-400/[0.03] p-3">
      <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground/70">
        <BellRing size={14} className="text-indigo-400" /> Your Watchlist — Reporting Soon
      </h3>
      <div className="flex flex-col gap-2">
        {upcoming.map((entry, index) => (
          <EarningsRow
            key={`${entry.symbol}-${entry.date}`}
            entry={entry}
            todayIso={todayIso}
            delayMs={Math.min(index * STAGGER_MS, MAX_STAGGER_MS)}
            watchlisted
          />
        ))}
      </div>
    </div>
  );
}

// Independent of the upcoming-list filter tabs — always reflects the last
// 7 days from the default (unfiltered) fetch, since "what already
// reported" is a fixed lookback, not something a This Week/Next Week
// toggle should affect. The sector filter still applies, since that's a
// page-wide control, not tied to the tabs.
function RecentlyReportedSection({
  entries,
  todayIso,
  sectorFilterActive,
  watchlistSymbols,
}: {
  entries: EarningsEntry[];
  todayIso: string;
  sectorFilterActive: boolean;
  watchlistSymbols: Set<string>;
}) {
  const [page, setPage] = useState(1);
  const listRef = useRef<HTMLDivElement>(null);

  const reported = useMemo(
    () =>
      entries
        .filter((entry) => entry.epsActual !== null && daysBetweenIso(entry.date, todayIso) < 0)
        .sort((a, b) => daysBetweenIso(b.date, todayIso) - daysBetweenIso(a.date, todayIso)),
    [entries, todayIso]
  );

  // Reset to page 1 whenever the sector filter changes the underlying set
  // (adjusting state during render, same pattern used by the Stock
  // Catalog's own filter-driven page reset).
  const [prevSectorFilterActive, setPrevSectorFilterActive] = useState(sectorFilterActive);
  if (sectorFilterActive !== prevSectorFilterActive) {
    setPrevSectorFilterActive(sectorFilterActive);
    setPage(1);
  }

  if (reported.length === 0) return null;

  const totalPages = Math.max(1, Math.ceil(reported.length / PAGE_SIZE));
  const visible = reported.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function handlePageChange(nextPage: number) {
    setPage(Math.min(Math.max(nextPage, 1), totalPages));
    listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div ref={listRef} className="flex scroll-mt-20 flex-col gap-3">
      <h3 className="text-sm font-semibold text-foreground/70">Recently Reported</h3>
      <div className="flex flex-col gap-2">
        {visible.map((entry, index) => (
          <EarningsRow
            key={`${entry.symbol}-${entry.date}`}
            entry={entry}
            todayIso={todayIso}
            delayMs={Math.min(index * STAGGER_MS, MAX_STAGGER_MS)}
            watchlisted={watchlistSymbols.has(entry.symbol)}
          />
        ))}
      </div>
      {totalPages > 1 && (
        <PaginationControls page={page} totalPages={totalPages} onPageChange={handlePageChange} />
      )}
    </div>
  );
}

const FILTER_TABS: Array<{ key: FilterMode; label: string }> = [
  { key: "thisWeek", label: "This Week" },
  { key: "nextWeek", label: "Next Week" },
  { key: "custom", label: "Custom Range" },
];

export default function EarningsPage() {
  const { status: sessionStatus } = useSession();
  const [defaultData, setDefaultData] = useState<EarningsCalendarData | null>(null);
  const [error, setError] = useState(false);
  const [filterMode, setFilterMode] = useState<FilterMode>("thisWeek");
  const [sector, setSector] = useState<SectorFilter>("All");

  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [customData, setCustomData] = useState<EarningsCalendarData | null>(null);
  const [customError, setCustomError] = useState<string | null>(null);
  const [customLoading, setCustomLoading] = useState(false);

  const [upcomingPage, setUpcomingPage] = useState(1);
  const upcomingListRef = useRef<HTMLDivElement>(null);

  // Fetched once here (rather than each row doing its own check) so up to
  // 40 rows at once never fire 40 redundant GET /api/watchlist calls — see
  // WatchlistStar's own `initialSaved` prop comment. Also doubles as the
  // input to the "Your Watchlist" priority section below.
  const [watchlistSymbols, setWatchlistSymbols] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;

    async function loadWatchlist() {
      if (sessionStatus !== "authenticated") {
        if (!cancelled) setWatchlistSymbols(new Set());
        return;
      }
      try {
        const response = await fetch("/api/watchlist");
        const body = await response.json().catch(() => null);
        if (cancelled || !body) return;
        const items: Array<{ symbol: string; assetType?: string }> = Array.isArray(body.items)
          ? body.items
          : [];
        setWatchlistSymbols(
          new Set(items.filter((item) => (item.assetType ?? "stock") === "stock").map((item) => item.symbol))
        );
      } catch {
        if (!cancelled) setWatchlistSymbols(new Set());
      }
    }

    loadWatchlist();
    return () => {
      cancelled = true;
    };
  }, [sessionStatus]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch("/api/earnings-calendar");
        const body = await response.json().catch(() => null);
        if (cancelled) return;

        if (!response.ok || !body) {
          setError(true);
          return;
        }
        setError(false);
        setDefaultData(body);
      } catch {
        if (!cancelled) setError(true);
      }
    }

    load();
    const id = setInterval(load, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  async function applyCustomRange() {
    if (!customFrom || !customTo) {
      setCustomError("Pick both a start and end date.");
      return;
    }
    if (customFrom > customTo) {
      setCustomError("Start date must be before end date.");
      return;
    }

    setCustomLoading(true);
    setCustomError(null);
    setCustomData(null);
    try {
      const response = await fetch(`/api/earnings-calendar?from=${customFrom}&to=${customTo}`);
      const body = await response.json().catch(() => null);
      if (!response.ok || !body) {
        setCustomError("Failed to load that date range.");
        return;
      }
      setCustomData(body);
    } catch {
      setCustomError("Failed to load that date range.");
    } finally {
      setCustomLoading(false);
    }
  }

  const todayIso = todayIsoUTC();

  function bySector(entry: EarningsEntry): boolean {
    return sector === "All" || (SYMBOL_SECTORS_MAP.get(entry.symbol)?.includes(sector) ?? false);
  }

  const recentlyReportedEntries = (defaultData?.entries ?? []).filter(bySector);

  const upcomingSource: EarningsEntry[] = sortChronologically(
    (filterMode === "custom"
      ? (customData?.entries ?? [])
      : (defaultData?.entries ?? []).filter((entry) => {
          const diff = daysBetweenIso(entry.date, todayIso);
          return filterMode === "thisWeek" ? diff >= 0 && diff <= 6 : diff >= 7 && diff <= 13;
        })
    ).filter(bySector)
  );

  // Reset to page 1 whenever the filter tab, sector, or (for custom range)
  // the underlying data itself changes — otherwise a page 3 selection
  // could easily land past the end of a much smaller filtered result.
  const upcomingFilterKey = `${filterMode}|${sector}|${filterMode === "custom" ? customData?.generatedAt ?? "" : ""}`;
  const [prevUpcomingFilterKey, setPrevUpcomingFilterKey] = useState(upcomingFilterKey);
  if (upcomingFilterKey !== prevUpcomingFilterKey) {
    setPrevUpcomingFilterKey(upcomingFilterKey);
    setUpcomingPage(1);
  }

  const upcomingTotalPages = Math.max(1, Math.ceil(upcomingSource.length / PAGE_SIZE));
  const visibleUpcoming = upcomingSource.slice(
    (upcomingPage - 1) * PAGE_SIZE,
    upcomingPage * PAGE_SIZE
  );
  const groups = withStartOffsets(buildGroups(visibleUpcoming, todayIso));
  const showUpcomingSkeleton = filterMode !== "custom" && !defaultData && !error;
  const showUpcomingError = filterMode !== "custom" && error;
  const hasUpcomingData = filterMode === "custom" ? customData !== null : defaultData !== null;

  function handleUpcomingPageChange(nextPage: number) {
    setUpcomingPage(Math.min(Math.max(nextPage, 1), upcomingTotalPages));
    upcomingListRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <main className="flex flex-1 flex-col items-center gap-8 p-8 pt-16">
      <div className="flex w-full max-w-3xl flex-col gap-2">
        <div className="flex items-center gap-2">
          <CalendarClock className="text-foreground" size={26} />
          <h1 className="text-3xl font-bold text-foreground">Earnings Calendar</h1>
        </div>
        <p className="text-sm text-foreground/50">
          Upcoming and recent earnings reports for well-known companies, sourced from Finnhub&apos;s
          earnings calendar.
        </p>
      </div>

      <div className="flex w-full max-w-3xl items-center justify-between gap-3">
        <p className="text-xs text-foreground/50">Filter the whole page by sector</p>
        <SectorFilterDropdown sector={sector} onChange={setSector} />
      </div>

      <RevealOnScroll className="flex w-full max-w-3xl flex-col gap-6">
        {defaultData && (
          <WatchlistEarningsSection
            entries={defaultData.entries}
            todayIso={todayIso}
            watchlistSymbols={watchlistSymbols}
          />
        )}

        {defaultData && (
          <RecentlyReportedSection
            entries={recentlyReportedEntries}
            todayIso={todayIso}
            sectorFilterActive={sector !== "All"}
            watchlistSymbols={watchlistSymbols}
          />
        )}

        <div ref={upcomingListRef} className="flex scroll-mt-20 flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-foreground/70">Upcoming Earnings</h3>
            <div className="flex gap-1 rounded-md border border-black/10 p-1 dark:border-white/15">
              {FILTER_TABS.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setFilterMode(tab.key)}
                  className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                    filterMode === tab.key
                      ? "bg-foreground/10 text-foreground"
                      : "text-foreground/50 hover:text-foreground"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {filterMode === "custom" && (
            <div className="flex flex-wrap items-end gap-3 rounded-md border border-black/10 p-3 dark:border-white/15">
              <label className="flex flex-col gap-1">
                <span className="text-xs text-foreground/60">From</span>
                <input
                  type="date"
                  value={customFrom}
                  onChange={(event) => setCustomFrom(event.target.value)}
                  className={inputClassName}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-foreground/60">To</span>
                <input
                  type="date"
                  value={customTo}
                  onChange={(event) => setCustomTo(event.target.value)}
                  className={inputClassName}
                />
              </label>
              <button
                type="button"
                onClick={applyCustomRange}
                disabled={customLoading}
                className="rounded-md border border-black/10 px-3 py-2 text-sm font-medium text-foreground transition-colors hover:border-black/30 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/15 dark:hover:border-white/30"
              >
                {customLoading ? "Loading…" : "Apply"}
              </button>
              {customError && <p className="w-full text-xs text-red-500">{customError}</p>}
            </div>
          )}

          <div className="flex flex-col gap-4">
            {showUpcomingSkeleton &&
              Array.from({ length: 5 }).map((_, i) => <EarningsRowSkeleton key={i} />)}

            {showUpcomingError && (
              <p className="text-sm text-red-500">Earnings calendar is temporarily unavailable.</p>
            )}

            {filterMode === "custom" && !customData && !customLoading && !customError && (
              <p className="text-sm text-foreground/60">Pick a date range and press Apply.</p>
            )}

            {hasUpcomingData && groups.length === 0 && (
              <p className="text-sm text-foreground/60">No notable earnings in this range.</p>
            )}

            {groups.map((group) => (
              <div key={group.key} className="flex flex-col gap-2">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-foreground/40">
                  {group.label}
                </h4>
                {group.entries.map((entry, index) => (
                  <EarningsRow
                    key={`${entry.symbol}-${entry.date}`}
                    entry={entry}
                    todayIso={todayIso}
                    delayMs={Math.min((group.startIndex + index) * STAGGER_MS, MAX_STAGGER_MS)}
                    watchlisted={watchlistSymbols.has(entry.symbol)}
                  />
                ))}
              </div>
            ))}
          </div>

          {upcomingTotalPages > 1 && (
            <PaginationControls
              page={upcomingPage}
              totalPages={upcomingTotalPages}
              onPageChange={handleUpcomingPageChange}
            />
          )}
        </div>

        <p className="border-t border-black/10 pt-3 text-xs text-foreground/40 dark:border-white/15">
          Limited to companies in this app&apos;s curated catalog to keep the calendar readable — a full
          unfiltered feed includes hundreds of small-cap reports per week. Estimates and actuals sourced
          from Finnhub; not financial advice.
        </p>
      </RevealOnScroll>
    </main>
  );
}
