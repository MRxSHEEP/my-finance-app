"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import RevealOnScroll from "@/components/RevealOnScroll";
import NumberField from "@/components/tools/NumberField";
import { formatCompactCurrency, formatCurrency, formatPercent, formatRatio, toNumber } from "@/lib/format";

interface ScreenerRow {
  ticker: string;
  name: string;
  sector: string;
  price: number | null;
  peRatio: number | null;
  marketCap: number | null;
  dividendYield: number | null;
}

interface ScreenerData {
  rows: ScreenerRow[];
  updatedAt: number;
}

type SortKey = "ticker" | "name" | "sector" | "price" | "peRatio" | "marketCap" | "dividendYield";
type SortDir = "asc" | "desc";

const DEFAULT_DIR: Record<SortKey, SortDir> = {
  ticker: "asc",
  name: "asc",
  sector: "asc",
  price: "desc",
  peRatio: "asc",
  marketCap: "desc",
  dividendYield: "desc",
};

const COLUMNS: Array<{ key: SortKey; label: string; align: "left" | "right" }> = [
  { key: "ticker", label: "Ticker", align: "left" },
  { key: "name", label: "Company", align: "left" },
  { key: "sector", label: "Sector", align: "left" },
  { key: "price", label: "Price", align: "right" },
  { key: "peRatio", label: "P/E", align: "right" },
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
    case "marketCap":
      return row.marketCap ?? -Infinity;
    case "dividendYield":
      return row.dividendYield ?? -Infinity;
  }
}

// Same "best value" convention as PeerComparisonCard on the stock deep-dive
// page — a lower P/E and a higher dividend yield are highlighted; market
// cap has no "best" direction, so it's informational only.
function computeBest(rows: ScreenerRow[], key: "peRatio" | "dividendYield", mode: "min" | "max"): number | null {
  const values = rows.map((row) => row[key]).filter((value): value is number => typeof value === "number");
  if (values.length === 0) return null;
  return mode === "min" ? Math.min(...values) : Math.max(...values);
}

export default function ScreenerPage() {
  const router = useRouter();
  const [data, setData] = useState<ScreenerData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [sector, setSector] = useState("All");
  const [minMarketCap, setMinMarketCap] = useState("");
  const [maxMarketCap, setMaxMarketCap] = useState("");
  const [minPeRatio, setMinPeRatio] = useState("");
  const [maxPeRatio, setMaxPeRatio] = useState("");
  const [minDividendYield, setMinDividendYield] = useState("");
  const [maxDividendYield, setMaxDividendYield] = useState("");

  const [sortKey, setSortKey] = useState<SortKey>("marketCap");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

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

  const sectors = useMemo(() => {
    if (!data) return ["All"];
    return ["All", ...Array.from(new Set(data.rows.map((row) => row.sector))).sort()];
  }, [data]);

  const filtered = useMemo(() => {
    if (!data) return [];

    const minCap = minMarketCap.trim() ? toNumber(minMarketCap) * 1000 : null;
    const maxCap = maxMarketCap.trim() ? toNumber(maxMarketCap) * 1000 : null;
    const minPE = minPeRatio.trim() ? toNumber(minPeRatio) : null;
    const maxPE = maxPeRatio.trim() ? toNumber(maxPeRatio) : null;
    const minDiv = minDividendYield.trim() ? toNumber(minDividendYield) : null;
    const maxDiv = maxDividendYield.trim() ? toNumber(maxDividendYield) : null;

    return data.rows.filter((row) => {
      if (sector !== "All" && row.sector !== sector) return false;
      if (minCap !== null && (row.marketCap === null || row.marketCap < minCap)) return false;
      if (maxCap !== null && (row.marketCap === null || row.marketCap > maxCap)) return false;
      if (minPE !== null && (row.peRatio === null || row.peRatio < minPE)) return false;
      if (maxPE !== null && (row.peRatio === null || row.peRatio > maxPE)) return false;
      if (minDiv !== null && (row.dividendYield === null || row.dividendYield < minDiv)) return false;
      if (maxDiv !== null && (row.dividendYield === null || row.dividendYield > maxDiv)) return false;
      return true;
    });
  }, [data, sector, minMarketCap, maxMarketCap, minPeRatio, maxPeRatio, minDividendYield, maxDividendYield]);

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
  const bestDividendYield = useMemo(() => computeBest(filtered, "dividendYield", "max"), [filtered]);

  // Same fade-on-change technique used by PriceChart's range switch: a
  // brief opacity dip whenever the visible result set changes, instead of
  // an instant table replacement.
  const [fading, setFading] = useState(false);
  const resultsKey = `${sector}|${minMarketCap}|${maxMarketCap}|${minPeRatio}|${maxPeRatio}|${minDividendYield}|${maxDividendYield}|${sortKey}|${sortDir}`;
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
    setSector("All");
    setMinMarketCap("");
    setMaxMarketCap("");
    setMinPeRatio("");
    setMaxPeRatio("");
    setMinDividendYield("");
    setMaxDividendYield("");
  }

  return (
    <main className="flex flex-1 flex-col items-center gap-6 p-8 pt-16 pb-20">
      <RevealOnScroll className="flex w-full max-w-5xl flex-col items-center gap-2 text-center">
        <h1 className="text-3xl font-bold text-foreground">Screener</h1>
        <p className="max-w-xl text-sm text-foreground/60">
          Filter a curated sample of well-known stocks by market cap, valuation, sector, and
          dividend yield. Click any row to open that stock&apos;s full overview.
        </p>
      </RevealOnScroll>

      <RevealOnScroll className="w-full max-w-5xl" delayMs={100}>
        <div className="rounded-md border border-black/10 p-6 text-sm dark:border-white/15">
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
            <NumberField label="Min Market Cap" prefix="$" suffix="B" value={minMarketCap} onChange={setMinMarketCap} />
            <NumberField label="Max Market Cap" prefix="$" suffix="B" value={maxMarketCap} onChange={setMaxMarketCap} />
            <NumberField label="Min P/E Ratio" value={minPeRatio} onChange={setMinPeRatio} />
            <NumberField label="Max P/E Ratio" value={maxPeRatio} onChange={setMaxPeRatio} />
            <NumberField label="Min Dividend Yield" suffix="%" value={minDividendYield} onChange={setMinDividendYield} />
            <NumberField label="Max Dividend Yield" suffix="%" value={maxDividendYield} onChange={setMaxDividendYield} />

            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-foreground">Sector</span>
              <select
                value={sector}
                onChange={(event) => setSector(event.target.value)}
                className="rounded-md border border-black/10 bg-transparent px-3 py-2 text-sm outline-none focus:border-black/30 dark:border-white/15 dark:focus:border-white/30"
              >
                {sectors.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
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
              <table className="w-full min-w-[720px] text-sm">
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
                          row.peRatio !== null && row.peRatio === bestPE
                            ? "font-semibold text-green-500"
                            : "text-foreground"
                        }`}
                      >
                        {row.peRatio !== null ? formatRatio(row.peRatio) : "—"}
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
