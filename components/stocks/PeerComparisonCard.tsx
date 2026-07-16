"use client";

import { useEffect, useState } from "react";

interface CompanyRow {
  symbol: string;
  isCurrent: boolean;
  peRatio: number | null;
  marketCap: number | null;
  eps: number | null;
  evEbitda: number | null;
  rating: number | null;
}

interface PeersData {
  rows: CompanyRow[];
}

type NumericKey = "peRatio" | "marketCap" | "eps" | "evEbitda" | "rating";

// "best" is omitted for marketCap — size alone isn't good/bad the way a
// cheaper P/E or a higher rating is, so that row is informational only.
const METRIC_ROWS: Array<{ key: NumericKey; label: string; format: (value: number) => string; best: "min" | "max" | null }> = [
  { key: "peRatio", label: "P/E Ratio", format: (v) => v.toFixed(2), best: "min" },
  { key: "marketCap", label: "Market Cap", format: (v) => `$${(v / 1000).toFixed(1)}B`, best: null },
  { key: "eps", label: "EPS", format: (v) => `$${v.toFixed(2)}`, best: "max" },
  { key: "evEbitda", label: "EV/EBITDA", format: (v) => v.toFixed(2), best: "min" },
  { key: "rating", label: "Analyst Rating", format: (v) => v.toFixed(1), best: "max" },
];

function computeBest(rows: CompanyRow[], key: NumericKey, mode: "min" | "max" | null): number | null {
  if (!mode) return null;
  const values = rows.map((row) => row[key]).filter((value): value is number => typeof value === "number");
  if (values.length === 0) return null;
  return mode === "min" ? Math.min(...values) : Math.max(...values);
}

export default function PeerComparisonCard({ ticker }: { ticker: string }) {
  const [data, setData] = useState<PeersData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!cancelled) {
        setData(null);
        setError(null);
      }
      try {
        const response = await fetch(`/api/stock/peers?ticker=${encodeURIComponent(ticker)}`);
        if (!response.ok) throw new Error("request failed");
        const body = await response.json();
        if (!cancelled) setData(body);
      } catch {
        if (!cancelled) setError("Data unavailable");
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [ticker]);

  const rows = data?.rows ?? [];

  return (
    <div className="flex flex-col gap-3 rounded-md border border-black/10 p-4 dark:border-white/15">
      <h3 className="font-semibold text-foreground">Peer Comparison</h3>

      {!data && !error && <div className="h-32 w-full animate-pulse rounded bg-foreground/10" />}

      {error && <p className="text-sm text-foreground/60">Data unavailable</p>}

      {data && rows.length <= 1 && (
        <p className="text-sm text-foreground/60">No peer data available for this ticker.</p>
      )}

      {data && rows.length > 1 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-sm">
            <thead>
              <tr>
                <th className="p-2 text-left text-xs font-medium text-foreground/50">Metric</th>
                {rows.map((row) => (
                  <th
                    key={row.symbol}
                    className={`p-2 text-right font-semibold ${
                      row.isCurrent ? "rounded-t-md bg-foreground/10 text-foreground" : "text-foreground/70"
                    }`}
                  >
                    {row.symbol}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {METRIC_ROWS.map((metricRow) => {
                const best = computeBest(rows, metricRow.key, metricRow.best);
                return (
                  <tr key={metricRow.key} className="border-t border-black/5 dark:border-white/10">
                    <td className="p-2 text-foreground/60">{metricRow.label}</td>
                    {rows.map((row) => {
                      const value = row[metricRow.key];
                      const isBest = typeof value === "number" && best !== null && value === best;
                      return (
                        <td
                          key={row.symbol}
                          className={`p-2 text-right ${row.isCurrent ? "bg-foreground/5" : ""} ${
                            isBest ? "font-semibold text-green-500" : "text-foreground"
                          }`}
                        >
                          {typeof value === "number" ? metricRow.format(value) : "—"}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
