"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Grid3x3, Search } from "lucide-react";
import RevealOnScroll from "@/components/RevealOnScroll";
import SparklineSlot from "@/components/SparklineSlot";
import PaginationControls from "@/components/Pagination";
import SectorFilterDropdown, { type SectorFilter } from "@/components/SectorFilterDropdown";
import StockLogo from "@/components/stocks/StockLogo";
import { cardClass } from "@/lib/cardStyles";
import { CATALOG_INPUT_BG } from "@/lib/stockCatalog";

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 250;
const STAGGER_MS = 30;
const MAX_STAGGER_MS = 300;
const MAX_EXTRA_SEARCH_MATCHES = 100;
// A never-before-fetched symbol's sparkline can still be mid-flight on the
// server (see lib/sparklineFetch.ts's own bounded per-batch wait) even
// after mini-quotes has already answered with `history: null` for it —
// this is the one bounded retry that catches that case, rather than
// leaving the row on "no chart data" forever just because it lost the
// race the first time. Comfortably longer than the server's own
// per-symbol wait so the retry actually has new data to find.
const SPARKLINE_RETRY_DELAY_MS = 6_000;
// Same threshold/treatment as TickerMiniCard's strong-mover glow, applied
// here too so the two ticker-listing surfaces on this page read as one
// consistent color language rather than two different conventions.
const STRONG_MOVE_THRESHOLD = 5;

interface CatalogEntry {
  symbol: string;
  name: string;
  sector: string;
  secondarySectors?: string[];
}

interface StockSymbolEntry {
  symbol: string;
  name: string;
  exchange: string;
}

interface MiniQuote {
  symbol: string;
  price: number | null;
  percentChange: number | null;
  history: { time: number; value: number }[] | null;
  sparklineStale: boolean;
  priceStale: boolean;
}

function formatPrice(price: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(price);
}

// Kept on the app's neutral purple regardless of which sector is active —
// unlike the dropdown beside it, search doesn't represent a specific
// sector, so it shouldn't borrow that sector's color as if it did. The
// fill itself is the shared neutral (see CATALOG_INPUT_BG) rather than a
// purple tint, so purple only ever shows up as the border/focus/icon
// accent, never as the input's dominant surface color.
function CatalogSearchInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs text-foreground/60">
      Search
      <div className="relative flex items-center">
        <Search size={14} className="pointer-events-none absolute left-3 text-purple-400" />
        <input
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Ticker or company name"
          className={`w-56 rounded-md border border-purple-400/30 py-1.5 pl-8 pr-3 text-sm text-foreground outline-none transition-colors duration-200 ease-out placeholder:text-foreground/40 hover:border-purple-400/50 focus:border-purple-400/60 ${CATALOG_INPUT_BG}`}
        />
      </div>
    </label>
  );
}

function CatalogRowSkeleton() {
  return (
    <div className={cardClass("neutral", { extra: "flex items-center gap-4 p-4" })}>
      <div className="h-7 w-7 shrink-0 animate-pulse rounded-full bg-foreground/10" />
      <div className="h-4 w-14 shrink-0 animate-pulse rounded bg-foreground/10" />
      <div className="h-4 flex-1 animate-pulse rounded bg-foreground/10" />
      <div className="h-8 w-24 shrink-0 animate-pulse rounded bg-foreground/10" />
      <div className="h-8 w-24 shrink-0 animate-pulse rounded bg-foreground/10" />
    </div>
  );
}

// The whole row is the click target (matching TickerMiniCard/WatchlistCard's
// "click anywhere to open the stock" convention) rather than a separate
// "View" button — one consistent click affordance across every ticker
// list on this page instead of a button-only pattern unique to the catalog.
function CatalogRow({ entry, quote }: { entry: CatalogEntry; quote?: MiniQuote }) {
  const hasQuote = quote?.price != null && quote?.percentChange != null;
  const isUp = hasQuote && quote!.percentChange! > 0;
  const isDown = hasQuote && quote!.percentChange! < 0;
  const isStrongMove = hasQuote && Math.abs(quote!.percentChange!) >= STRONG_MOVE_THRESHOLD;

  return (
    <Link
      href={`/stocks?ticker=${encodeURIComponent(entry.symbol)}`}
      className={cardClass("neutral", {
        interactive: true,
        extra: `flex items-center gap-4 p-4 hover:scale-[1.01] ${
          isStrongMove ? (isUp ? "ring-1 ring-green-400/40 shadow-green-400/10" : "ring-1 ring-red-400/40 shadow-red-400/10") : ""
        }`,
      })}
    >
      <StockLogo symbol={entry.symbol} size={28} />
      <div className="w-16 shrink-0">
        <span className="font-semibold text-foreground">{entry.symbol}</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-foreground/70">{entry.name}</p>
      </div>
      <div className="h-8 w-24 shrink-0">
        <SparklineSlot
          history={quote ? quote.history : undefined}
          stale={(quote?.sparklineStale ?? false) || (quote?.priceStale ?? false)}
          height={32}
        />
      </div>
      <div className="w-24 shrink-0 text-right">
        <div className="font-medium text-foreground">{hasQuote ? formatPrice(quote!.price!) : "—"}</div>
        {hasQuote && (
          <div
            className={`text-xs font-medium ${
              isUp ? "text-green-500" : isDown ? "text-red-500" : "text-foreground/50"
            }`}
          >
            {isUp ? "▲" : isDown ? "▼" : ""} {quote!.percentChange! >= 0 ? "+" : ""}
            {quote!.percentChange!.toFixed(2)}%
          </div>
        )}
      </div>
    </Link>
  );
}

export default function StockCatalogSection() {
  const [catalog, setCatalog] = useState<CatalogEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // The full NYSE/NASDAQ symbol universe (~6,100 tickers, no sector data)
  // that extends search beyond the curated catalog above — fetched lazily
  // (see the effect below) only once the user actually searches, rather
  // than on every page load, since most visits just browse by sector and
  // would never need it.
  const [symbolUniverse, setSymbolUniverse] = useState<StockSymbolEntry[] | null>(null);
  const symbolUniverseRequestedRef = useRef(false);

  const [sector, setSector] = useState<SectorFilter>("All");
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);

  const [quotes, setQuotes] = useState<Map<string, MiniQuote>>(new Map());
  const fetchedSymbolsRef = useRef<Set<string>>(new Set());
  const retriedSymbolsRef = useRef<Set<string>>(new Set());
  const listRef = useRef<HTMLDivElement>(null);

  // The whole curated catalog (~130 rows, static, no upstream API calls)
  // is fetched once — sector/search filtering and pagination below all
  // happen client-side against this one array instead of round-tripping
  // to the server on every keystroke, filter change, or page flip. This
  // is the sector-browsable set; search additionally reaches into the
  // much larger symbolUniverse fetched below once the user actually
  // types something, since most publicly traded tickers aren't curated
  // into a sector here.
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch("/api/stock/catalog");
        const body = await response.json().catch(() => null);
        if (cancelled) return;

        if (!response.ok || !Array.isArray(body?.entries)) {
          setError("Failed to load stock catalog");
          return;
        }

        setError(null);
        setCatalog(body.entries);
      } catch {
        if (!cancelled) setError("Failed to load stock catalog");
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // Debounced so typing doesn't refilter (and therefore doesn't re-fetch
  // quotes for a newly-revealed set of rows) on every keystroke.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchInput), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Lazily fetches the broader symbol universe the first time the user
  // actually types a search term — a ref (not just checking
  // `symbolUniverse === null`) guards against firing a second request
  // while the first is still in flight, since the effect re-runs on every
  // keystroke's debounced value until the fetch resolves.
  useEffect(() => {
    if (!debouncedSearch.trim() || symbolUniverseRequestedRef.current) return;
    symbolUniverseRequestedRef.current = true;

    let cancelled = false;
    async function load() {
      try {
        const response = await fetch("/api/stock/symbols");
        const body = await response.json().catch(() => null);
        if (cancelled) return;
        setSymbolUniverse(Array.isArray(body?.entries) ? body.entries : []);
      } catch {
        if (!cancelled) setSymbolUniverse([]);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [debouncedSearch]);

  const filtered = useMemo(() => {
    if (!catalog) return [];
    const term = debouncedSearch.trim().toLowerCase();

    const curatedMatches = catalog.filter((entry) => {
      const matchesSector =
        sector === "All" || entry.sector === sector || (entry.secondarySectors?.includes(sector) ?? false);
      if (!matchesSector) return false;
      if (term && !entry.symbol.toLowerCase().includes(term) && !entry.name.toLowerCase().includes(term)) {
        return false;
      }
      return true;
    });

    // The broader universe has no sector data, so it can only ever
    // supplement an "All Sectors" search — never sector-filtered
    // browsing — and only once it's actually loaded (see the effect
    // above). Curated entries are excluded from it by symbol so a stock
    // already in the curated catalog never appears twice.
    if (!term || sector !== "All" || !symbolUniverse) return curatedMatches;

    const curatedSymbols = new Set(catalog.map((entry) => entry.symbol));
    // A short, common search term (e.g. a single letter) can substring-match
    // hundreds of tickers across a ~6,100-symbol universe with no relevance
    // ranking of its own — a symbol-starts-with hit (typing "PYPL" and
    // meaning PayPal) is put ahead of a mere name-contains hit, and the
    // result capped, so an unranked flood of loose matches doesn't bury the
    // ticker the user was actually typing under a hundred pages of them.
    const extraMatches: CatalogEntry[] = symbolUniverse
      .filter(
        (entry) =>
          !curatedSymbols.has(entry.symbol) &&
          (entry.symbol.toLowerCase().includes(term) || entry.name.toLowerCase().includes(term))
      )
      .sort((a, b) => {
        const aStarts = a.symbol.toLowerCase().startsWith(term) ? 0 : 1;
        const bStarts = b.symbol.toLowerCase().startsWith(term) ? 0 : 1;
        return aStarts - bStarts;
      })
      .slice(0, MAX_EXTRA_SEARCH_MATCHES)
      .map((entry) => ({ symbol: entry.symbol, name: entry.name, sector: "" }));

    return [...curatedMatches, ...extraMatches];
  }, [catalog, sector, debouncedSearch, symbolUniverse]);

  // Sector and (debounced) search are the only two inputs to `filtered`, so
  // a changed filter resets back to page 1 — otherwise a page 3 selection
  // could easily land past the end of a much smaller filtered result set.
  // Reset during render (same "adjusting state when inputs change" pattern
  // RankingsTable uses for its own search/category reset) rather than in
  // an effect, which would cost an extra render showing a stale page.
  const filterKey = `${sector}|${debouncedSearch}`;
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
  if (filterKey !== prevFilterKey) {
    setPrevFilterKey(filterKey);
    setPage(1);
  }

  // Purely cosmetic settle-in pulse when the active filter changes —
  // unlike the old server-paginated version, filtering itself is now
  // synchronous, so this never gates on network.
  const [settling, setSettling] = useState(false);
  const previousFilterKeyRef = useRef(filterKey);

  useEffect(() => {
    if (previousFilterKeyRef.current === filterKey) return;
    previousFilterKeyRef.current = filterKey;
    setSettling(true);
    const timer = setTimeout(() => setSettling(false), 150);
    return () => clearTimeout(timer);
  }, [filterKey]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visibleEntries = useMemo(
    () => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filtered, page]
  );
  const visibleSymbolsKey = useMemo(
    () => visibleEntries.map((entry) => entry.symbol).join(","),
    [visibleEntries]
  );

  // Only fetches quotes for symbols not already cached — sector/search
  // changes and page navigation both reveal a mostly-different set (cheap
  // to refetch), but flipping back to a previously-visited page reuses
  // whatever's already in `quotes` instead of re-requesting it.
  useEffect(() => {
    if (!visibleSymbolsKey) return;

    const missing = visibleSymbolsKey.split(",").filter((symbol) => !fetchedSymbolsRef.current.has(symbol));
    if (missing.length === 0) return;

    missing.forEach((symbol) => fetchedSymbolsRef.current.add(symbol));
    let cancelled = false;
    let retryTimeoutId: ReturnType<typeof setTimeout> | undefined;

    async function fetchQuotes(symbols: string[]): Promise<MiniQuote[]> {
      const response = await fetch(`/api/stock/mini-quotes?symbols=${encodeURIComponent(symbols.join(","))}`);
      const body = await response.json().catch(() => null);
      return Array.isArray(body?.quotes) ? body.quotes : [];
    }

    async function loadQuotes() {
      try {
        const list = await fetchQuotes(missing);
        if (cancelled) return;

        setQuotes((prev) => {
          const next = new Map(prev);
          list.forEach((quote) => next.set(quote.symbol, quote));
          return next;
        });

        // A symbol can still be mid-flight server-side (see
        // lib/sparklineFetch.ts's own bounded per-batch wait) even after
        // this response already answered `history: null` for it — one
        // bounded retry catches that case instead of leaving the row on
        // "no chart data" forever just because it lost the race the first
        // time. Never marked stale, since a stale result IS real data to
        // show, just not fresh — nothing to retry there.
        const retryCandidates = list
          .filter((quote) => quote.history === null && !quote.sparklineStale)
          .map((quote) => quote.symbol)
          .filter((symbol) => !retriedSymbolsRef.current.has(symbol));

        if (retryCandidates.length === 0) return;
        retryCandidates.forEach((symbol) => retriedSymbolsRef.current.add(symbol));

        retryTimeoutId = setTimeout(async () => {
          if (cancelled) return;
          try {
            const retried = await fetchQuotes(retryCandidates);
            if (cancelled) return;
            setQuotes((prev) => {
              const next = new Map(prev);
              retried.forEach((quote) => next.set(quote.symbol, quote));
              return next;
            });
          } catch {
            // Leave the existing "no chart data" fallback in place.
          }
        }, SPARKLINE_RETRY_DELAY_MS);
      } catch {
        // Rows for these symbols just keep showing their "—" placeholder —
        // matches this app's established graceful-degrade convention.
      }
    }

    loadQuotes();
    return () => {
      cancelled = true;
      clearTimeout(retryTimeoutId);
    };
  }, [visibleSymbolsKey]);

  function handleSectorChange(nextSector: SectorFilter) {
    setSector(nextSector);
  }

  // Replaces the row set outright (page-based) rather than appending to it
  // (the old "Load more" behavior), so the list never grows unbounded —
  // and scrolls back to the top of the list so users aren't left looking
  // at whatever happened to be at the old scroll position.
  function handlePageChange(nextPage: number) {
    setPage(Math.min(Math.max(nextPage, 1), totalPages));
    listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <RevealOnScroll className="flex w-full flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Grid3x3 size={20} className="text-purple-400" />
            <h2 className="text-xl font-bold text-foreground">Stock Catalog</h2>
          </div>
          <p className="text-sm text-foreground/50">Browse well-known stocks by sector</p>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <CatalogSearchInput value={searchInput} onChange={setSearchInput} />
          <SectorFilterDropdown sector={sector} onChange={handleSectorChange} />
        </div>
      </div>

      <div
        ref={listRef}
        className="flex flex-col gap-2 scroll-mt-20 transition-opacity duration-200 ease-out"
        style={{ opacity: settling ? 0.4 : 1 }}
      >
        {catalog === null &&
          !error &&
          Array.from({ length: 8 }).map((_, i) => <CatalogRowSkeleton key={i} />)}

        {error && <p className="text-sm text-red-500">{error}</p>}

        {catalog !== null && filtered.length === 0 && !error && (
          <p className="text-sm text-foreground/60">
            No stocks found. Try a different search term or sector.
          </p>
        )}

        {visibleEntries.map((entry, index) => (
          <RevealOnScroll key={entry.symbol} delayMs={Math.min(index * STAGGER_MS, MAX_STAGGER_MS)}>
            <CatalogRow entry={entry} quote={quotes.get(entry.symbol)} />
          </RevealOnScroll>
        ))}
      </div>

      {filtered.length > 0 && (
        <PaginationControls page={page} totalPages={totalPages} onPageChange={handlePageChange} />
      )}
    </RevealOnScroll>
  );
}
