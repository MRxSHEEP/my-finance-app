"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bookmark, Trash2 } from "lucide-react";
import { CONCEPT_VISUALS, CONCEPT_COLOR_CLASSES } from "@/lib/conceptVisuals";
import RevealOnScroll from "@/components/RevealOnScroll";
import NumberField from "@/components/tools/NumberField";
import SectorFilterDropdown, { type SectorFilter } from "@/components/SectorFilterDropdown";
import { formatCompactCurrency, formatCurrency, formatPercent, formatRatio, toNumber } from "@/lib/format";

interface ScreenerRow {
  ticker: string;
  name: string;
  sector: string;
  price: number | null;
  peRatio: number | null;
  marketCap: number | null;
  dividendYield: number | null;
  forwardPE: number | null;
  revenueGrowth: number | null;
  roe: number | null;
}

interface ScreenerData {
  rows: ScreenerRow[];
  updatedAt: number;
}

type SortKey =
  | "ticker"
  | "name"
  | "sector"
  | "price"
  | "peRatio"
  | "marketCap"
  | "dividendYield"
  | "forwardPE"
  | "revenueGrowth"
  | "roe";
type SortDir = "asc" | "desc";

const DEFAULT_DIR: Record<SortKey, SortDir> = {
  ticker: "asc",
  name: "asc",
  sector: "asc",
  price: "desc",
  peRatio: "asc",
  marketCap: "desc",
  dividendYield: "desc",
  forwardPE: "asc",
  revenueGrowth: "desc",
  roe: "desc",
};

const COLUMNS: Array<{ key: SortKey; label: string; align: "left" | "right" }> = [
  { key: "ticker", label: "Ticker", align: "left" },
  { key: "name", label: "Company", align: "left" },
  { key: "sector", label: "Sector", align: "left" },
  { key: "price", label: "Price", align: "right" },
  { key: "peRatio", label: "P/E", align: "right" },
  { key: "forwardPE", label: "Fwd P/E", align: "right" },
  { key: "revenueGrowth", label: "Rev. Growth", align: "right" },
  { key: "roe", label: "ROE", align: "right" },
  { key: "marketCap", label: "Market Cap", align: "right" },
  { key: "dividendYield", label: "Div. Yield", align: "right" },
];

function sortValue(row: ScreenerRow, key: SortKey): number | string {
  switch (key) {
    case "ticker":
      return row.ticker;
    case "name":
      return row.name.toLowerCase();
    case "sector":
      return row.sector.toLowerCase();
    case "price":
      return row.price ?? -Infinity;
    case "peRatio":
      return row.peRatio ?? Infinity;
    case "forwardPE":
      return row.forwardPE ?? Infinity;
    case "revenueGrowth":
      return row.revenueGrowth ?? -Infinity;
    case "roe":
      return row.roe ?? -Infinity;
    case "marketCap":
      return row.marketCap ?? -Infinity;
    case "dividendYield":
      return row.dividendYield ?? -Infinity;
  }
}

// Same "best value" convention as PeerComparisonCard on the stock deep-dive
// page — lower P/E multiples and higher yield/growth/return figures are
// highlighted; market cap has no "best" direction, so it's informational only.
function computeBest(
  rows: ScreenerRow[],
  key: "peRatio" | "forwardPE" | "dividendYield" | "revenueGrowth" | "roe",
  mode: "min" | "max"
): number | null {
  const values = rows.map((row) => row[key]).filter((value): value is number => typeof value === "number");
  if (values.length === 0) return null;
  return mode === "min" ? Math.min(...values) : Math.max(...values);
}

interface FilterState {
  sector: SectorFilter;
  minMarketCap: string;
  maxMarketCap: string;
  minPeRatio: string;
  maxPeRatio: string;
  minDividendYield: string;
  maxDividendYield: string;
  minForwardPe: string;
  maxForwardPe: string;
  minRevenueGrowth: string;
  minRoe: string;
}

const DEFAULT_FILTERS: FilterState = {
  sector: "All",
  minMarketCap: "",
  maxMarketCap: "",
  minPeRatio: "",
  maxPeRatio: "",
  minDividendYield: "",
  maxDividendYield: "",
  minForwardPe: "",
  maxForwardPe: "",
  minRevenueGrowth: "",
  minRoe: "",
};

interface SavedFilter {
  name: string;
  filters: FilterState;
}

const SAVED_FILTERS_KEY = "noble:screener:savedFilters";

function loadSavedFilters(): SavedFilter[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(SAVED_FILTERS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function ScreenerPage() {
  const router = useRouter();
  const [data, setData] = useState<ScreenerData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([]);
  const [saveName, setSaveName] = useState("");

  const [sortKey, setSortKey] = useState<SortKey>("marketCap");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // Reading localStorage during the lazy useState initializer above would
  // run during server rendering too (where it's unavailable) and, if
  // deferred there instead, could hydrate with different pill content
  // than the server's empty-list markup — so this genuinely needs to
  // happen after mount, in an effect. The setTimeout defers the setState
  // itself to a macrotask (rather than calling it synchronously in the
  // effect body), which is what the React Compiler's set-state-in-effect
  // check requires — the same pattern used elsewhere in this app for a
  // one-time post-mount read.
  useEffect(() => {
    const timer = setTimeout(() => setSavedFilters(loadSavedFilters()), 0);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch("/api/screener");
        const body = await response.json().catch(() => null);
        if (cancelled) return;

        if (!response.ok) {
          setError(body?.error ?? "Failed to load screener data.");
          return;
        }

        setData(body);
      } catch {
        if (!cancelled) setError("Failed to load screener data.");
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  function updateFilter<K extends keyof FilterState>(key: K, value: FilterState[K]) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  const filtered = useMemo(() => {
    if (!data) return [];

    const minCap = filters.minMarketCap.trim() ? toNumber(filters.minMarketCap) * 1000 : null;
    const maxCap = filters.maxMarketCap.trim() ? toNumber(filters.maxMarketCap) * 1000 : null;
    const minPE = filters.minPeRatio.trim() ? toNumber(filters.minPeRatio) : null;
    const maxPE = filters.maxPeRatio.trim() ? toNumber(filters.maxPeRatio) : null;
    const minDiv = filters.minDividendYield.trim() ? toNumber(filters.minDividendYield) : null;
    const maxDiv = filters.maxDividendYield.trim() ? toNumber(filters.maxDividendYield) : null;
    const minFwdPE = filters.minForwardPe.trim() ? toNumber(filters.minForwardPe) : null;
    const maxFwdPE = filters.maxForwardPe.trim() ? toNumber(filters.maxForwardPe) : null;
    const minRevGrowth = filters.minRevenueGrowth.trim() ? toNumber(filters.minRevenueGrowth) : null;
    const minRoeFilter = filters.minRoe.trim() ? toNumber(filters.minRoe) : null;

    return data.rows.filter((row) => {
      if (filters.sector !== "All" && row.sector !== filters.sector) return false;
      if (minCap !== null && (row.marketCap === null || row.marketCap < minCap)) return false;
      if (maxCap !== null && (row.marketCap === null || row.marketCap > maxCap)) return false;
      if (minPE !== null && (row.peRatio === null || row.peRatio < minPE)) return false;
      if (maxPE !== null && (row.peRatio === null || row.peRatio > maxPE)) return false;
      if (minDiv !== null && (row.dividendYield === null || row.dividendYield < minDiv)) return false;
      if (maxDiv !== null && (row.dividendYield === null || row.dividendYield > maxDiv)) return false;
      if (minFwdPE !== null && (row.forwardPE === null || row.forwardPE < minFwdPE)) return false;
      if (maxFwdPE !== null && (row.forwardPE === null || row.forwardPE > maxFwdPE)) return false;
      if (minRevGrowth !== null && (row.revenueGrowth === null || row.revenueGrowth < minRevGrowth)) return false;
      if (minRoeFilter !== null && (row.roe === null || row.roe < minRoeFilter)) return false;
      return true;
    });
  }, [data, filters]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const va = sortValue(a, sortKey);
      const vb = sortValue(b, sortKey);
      const cmp =
        typeof va === "string" && typeof vb === "string" ? va.localeCompare(vb) : (va as number) - (vb as number);
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  const bestPE = useMemo(() => computeBest(filtered, "peRatio", "min"), [filtered]);
  const bestForwardPE = useMemo(() => computeBest(filtered, "forwardPE", "min"), [filtered]);
  const bestDividendYield = useMemo(() => computeBest(filtered, "dividendYield", "max"), [filtered]);
  const bestRevenueGrowth = useMemo(() => computeBest(filtered, "revenueGrowth", "max"), [filtered]);
  const bestRoe = useMemo(() => computeBest(filtered, "roe", "max"), [filtered]);

  // Same fade-on-change technique used by PriceChart's range switch: a
  // brief opacity dip whenever the visible result set changes, instead of
  // an instant table replacement.
  const [fading, setFading] = useState(false);
  const resultsKey = `${JSON.stringify(filters)}|${sortKey}|${sortDir}`;
  const previousResultsKeyRef = useRef(resultsKey);

  useEffect(() => {
    if (previousResultsKeyRef.current === resultsKey) return;
    previousResultsKeyRef.current = resultsKey;
    setFading(true);
    const timer = setTimeout(() => setFading(false), 200);
    return () => clearTimeout(timer);
  }, [resultsKey]);

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(DEFAULT_DIR[key]);
    }
  }

  function resetFilters() {
    setFilters(DEFAULT_FILTERS);
  }

  function saveCurrentFilters() {
    const name = saveName.trim();
    if (!name) return;
    const next = [...savedFilters.filter((f) => f.name !== name), { name, filters }];
    setSavedFilters(next);
    window.localStorage.setItem(SAVED_FILTERS_KEY, JSON.stringify(next));
    setSaveName("");
  }

  function loadSavedFilter(saved: SavedFilter) {
    setFilters(saved.filters);
  }

  function deleteSavedFilter(name: string) {
    const next = savedFilters.filter((f) => f.name !== name);
    setSavedFilters(next);
    window.localStorage.setItem(SAVED_FILTERS_KEY, JSON.stringify(next));
  }

  const { icon: ScreenerIcon, color: screenerColor } = CONCEPT_VISUALS.screener;
  const screenerIconColorClass = CONCEPT_COLOR_CLASSES[screenerColor].icon;

  return (
    <main className="flex flex-1 flex-col items-center gap-6 p-8 pt-16 pb-20">
      <RevealOnScroll className="flex w-full max-w-5xl flex-col items-center gap-2 text-center">
        <div className="flex items-center gap-2">
          <ScreenerIcon className={screenerIconColorClass} size={26} />
          <h1 className="text-3xl font-bold text-foreground">Stock Screener</h1>
        </div>
        <p className="max-w-xl text-sm text-foreground/60">
          Filter a curated sample of well-known stocks by sector, valuation, and growth. Click any
          row to open that stock&apos;s full overview.
        </p>
      </RevealOnScroll>

      <RevealOnScroll className="w-full max-w-5xl" delayMs={100}>
        <div className="rounded-md border border-purple-400/20 p-6 text-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">Filters</h2>
            <button
              type="button"
              onClick={resetFilters}
              className="text-xs font-medium text-foreground/60 hover:text-foreground hover:underline"
            >
              Reset filters
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <SectorFilterDropdown sector={filters.sector} onChange={(value) => updateFilter("sector", value)} />
            <NumberField
              label="Min Market Cap"
              prefix="$"
              suffix="B"
              value={filters.minMarketCap}
              onChange={(v) => updateFilter("minMarketCap", v)}
            />
            <NumberField
              label="Max Market Cap"
              prefix="$"
              suffix="B"
              value={filters.maxMarketCap}
              onChange={(v) => updateFilter("maxMarketCap", v)}
            />
            <NumberField label="Min P/E Ratio" value={filters.minPeRatio} onChange={(v) => updateFilter("minPeRatio", v)} />
            <NumberField label="Max P/E Ratio" value={filters.maxPeRatio} onChange={(v) => updateFilter("maxPeRatio", v)} />
            <NumberField
              label="Min Forward P/E"
              value={filters.minForwardPe}
              onChange={(v) => updateFilter("minForwardPe", v)}
            />
            <NumberField
              label="Max Forward P/E"
              value={filters.maxForwardPe}
              onChange={(v) => updateFilter("maxForwardPe", v)}
            />
            <NumberField
              label="Min Revenue Growth"
              suffix="%"
              value={filters.minRevenueGrowth}
              onChange={(v) => updateFilter("minRevenueGrowth", v)}
              helperText="Year-over-year, trailing twelve months."
            />
            <NumberField
              label="Min ROE"
              suffix="%"
              value={filters.minRoe}
              onChange={(v) => updateFilter("minRoe", v)}
              helperText="Return on equity, trailing twelve months."
            />
            <NumberField
              label="Min Dividend Yield"
              suffix="%"
              value={filters.minDividendYield}
              onChange={(v) => updateFilter("minDividendYield", v)}
            />
            <NumberField
              label="Max Dividend Yield"
              suffix="%"
              value={filters.maxDividendYield}
              onChange={(v) => updateFilter("maxDividendYield", v)}
            />
          </div>

          <div className="mt-5 flex flex-col gap-2 border-t border-black/10 pt-4 dark:border-white/15">
            <span className="text-xs font-medium text-foreground/70">Saved filter combinations</span>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                placeholder="Name this combination…"
                className="w-48 rounded-md border border-black/10 bg-transparent px-3 py-1.5 text-sm outline-none focus:border-black/30 dark:border-white/15 dark:focus:border-white/30"
              />
              <button
                type="button"
                onClick={saveCurrentFilters}
                disabled={!saveName.trim()}
                className="inline-flex items-center gap-1.5 rounded-md border border-purple-400/30 bg-purple-400/[0.06] px-3 py-1.5 text-xs font-medium text-purple-400 transition-colors hover:border-purple-400/50 hover:bg-purple-400/10 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Bookmark size={13} /> Save current filters
              </button>
            </div>
            {savedFilters.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {savedFilters.map((saved) => (
                  <div
                    key={saved.name}
                    className="flex items-center gap-1.5 rounded-full border border-black/10 py-1 pl-3 pr-1.5 text-xs dark:border-white/15"
                  >
                    <button type="button" onClick={() => loadSavedFilter(saved)} className="text-foreground/70 hover:text-foreground">
                      {saved.name}
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteSavedFilter(saved.name)}
                      aria-label={`Delete "${saved.name}"`}
                      className="rounded-full p-1 text-foreground/40 hover:bg-red-500/10 hover:text-red-500"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </RevealOnScroll>

      <RevealOnScroll className="w-full max-w-5xl" delayMs={150}>
        {!data && !error && (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-foreground/20 border-t-foreground/60" />
            <p className="text-sm text-foreground/60">
              Loading market data — the first load each hour can take a minute or two while
              fundamentals refresh for the full ticker list.
            </p>
          </div>
        )}

        {error && !data && <p className="py-8 text-center text-sm text-red-500">{error}</p>}

        {data && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between text-xs text-foreground/50">
              <span>
                {sorted.length} of {data.rows.length} stocks match
              </span>
              <span>Data as of {new Date(data.updatedAt).toLocaleTimeString()}</span>
            </div>

            <div
              className="overflow-x-auto rounded-md border border-black/10 transition-opacity duration-200 ease-out dark:border-white/15"
              style={{ opacity: fading ? 0.3 : 1 }}
            >
              <table className="w-full min-w-[920px] text-sm">
                <thead>
                  <tr className="border-b border-black/10 dark:border-white/15">
                    {COLUMNS.map((column) => {
                      const active = column.key === sortKey;
                      return (
                        <th
                          key={column.key}
                          className={`p-2 text-xs font-medium text-foreground/50 ${
                            column.align === "right" ? "text-right" : "text-left"
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => handleSort(column.key)}
                            className={`inline-flex items-center gap-1 hover:text-foreground ${
                              column.align === "right" ? "flex-row-reverse" : ""
                            } ${active ? "text-foreground" : ""}`}
                          >
                            {column.label}
                            {active && <span className="text-[10px]">{sortDir === "asc" ? "▲" : "▼"}</span>}
                          </button>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((row) => (
                    <tr
                      key={row.ticker}
                      onClick={() => router.push(`/stocks?ticker=${encodeURIComponent(row.ticker)}`)}
                      className="cursor-pointer border-t border-black/5 hover:bg-foreground/5 dark:border-white/10"
                    >
                      <td className="p-2 font-medium text-foreground">{row.ticker}</td>
                      <td className="p-2 text-foreground/80">{row.name}</td>
                      <td className="p-2 text-foreground/60">{row.sector}</td>
                      <td className="p-2 text-right text-foreground">
                        {row.price !== null ? formatCurrency(row.price) : "—"}
                      </td>
                      <td
                        className={`p-2 text-right ${
                          row.peRatio !== null && row.peRatio === bestPE ? "font-semibold text-green-500" : "text-foreground"
                        }`}
                      >
                        {row.peRatio !== null ? formatRatio(row.peRatio) : "—"}
                      </td>
                      <td
                        className={`p-2 text-right ${
                          row.forwardPE !== null && row.forwardPE === bestForwardPE
                            ? "font-semibold text-green-500"
                            : "text-foreground"
                        }`}
                      >
                        {row.forwardPE !== null ? formatRatio(row.forwardPE) : "—"}
                      </td>
                      <td
                        className={`p-2 text-right ${
                          row.revenueGrowth !== null && row.revenueGrowth === bestRevenueGrowth
                            ? "font-semibold text-green-500"
                            : "text-foreground"
                        }`}
                      >
                        {row.revenueGrowth !== null ? formatPercent(row.revenueGrowth) : "—"}
                      </td>
                      <td
                        className={`p-2 text-right ${
                          row.roe !== null && row.roe === bestRoe ? "font-semibold text-green-500" : "text-foreground"
                        }`}
                      >
                        {row.roe !== null ? formatPercent(row.roe) : "—"}
                      </td>
                      <td className="p-2 text-right text-foreground">
                        {row.marketCap !== null ? formatCompactCurrency(row.marketCap * 1_000_000) : "—"}
                      </td>
                      <td
                        className={`p-2 text-right ${
                          row.dividendYield !== null && row.dividendYield === bestDividendYield
                            ? "font-semibold text-green-500"
                            : "text-foreground"
                        }`}
                      >
                        {row.dividendYield !== null ? formatPercent(row.dividendYield) : "—"}
                      </td>
                    </tr>
                  ))}

                  {sorted.length === 0 && (
                    <tr>
                      <td colSpan={COLUMNS.length} className="p-8 text-center text-sm text-foreground/60">
                        No stocks match the current filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </RevealOnScroll>
    </main>
  );
}
