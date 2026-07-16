"use client";

import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

interface EarningsQuarter {
  period: string;
  year: number;
  quarter: number;
  actual: number | null;
  estimate: number | null;
  surprisePercent: number | null;
}

interface EarningsData {
  nextEarningsDate: string | null;
  quarters: EarningsQuarter[];
}

// Computed once when the data arrives (inside the effect) rather than
// from Date.now() during render — render must stay pure/deterministic,
// and days-until-earnings doesn't need to tick live anyway.
interface EarningsState extends EarningsData {
  daysUntil: number | null;
}

function formatCountdown(days: number): string {
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days < 0) return "recently reported";
  return `in ${days} days`;
}

export default function EarningsCard({ ticker }: { ticker: string }) {
  const [data, setData] = useState<EarningsState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!cancelled) {
        setData(null);
        setError(null);
      }

      try {
        const response = await fetch(`/api/stock/earnings?ticker=${encodeURIComponent(ticker)}`);
        if (!response.ok) throw new Error("request failed");
        const body: EarningsData = await response.json();
        if (cancelled) return;

        const daysUntil = body.nextEarningsDate
          ? Math.round(
              (new Date(`${body.nextEarningsDate}T00:00:00Z`).getTime() - Date.now()) / 86_400_000
            )
          : null;
        setData({ ...body, daysUntil });
      } catch {
        if (!cancelled) setError("Data unavailable");
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [ticker]);

  const daysUntil = data?.daysUntil ?? null;
  const isUrgent = daysUntil !== null && daysUntil >= 0 && daysUntil <= 7;

  const chartData = (data?.quarters ?? []).map((quarter) => ({
    label: `Q${quarter.quarter} '${String(quarter.year).slice(2)}`,
    estimate: quarter.estimate,
    actual: quarter.actual,
    beat:
      quarter.actual !== null && quarter.estimate !== null ? quarter.actual >= quarter.estimate : null,
    surprisePercent: quarter.surprisePercent,
  }));

  return (
    <div className="flex flex-col gap-3 rounded-md border border-black/10 p-4 dark:border-white/15">
      <h3 className="font-semibold text-foreground">Earnings</h3>

      {!data && !error && (
        <div className="flex flex-col gap-2">
          <div className="h-8 w-full animate-pulse rounded bg-foreground/10" />
          <div className="h-40 w-full animate-pulse rounded bg-foreground/10" />
        </div>
      )}

      {error && <p className="text-sm text-foreground/60">Data unavailable</p>}

      {data && (
        <>
          {data.nextEarningsDate && daysUntil !== null ? (
            <div
              className={`flex flex-wrap items-center gap-2 rounded-md px-3 py-2 text-sm ${
                isUrgent ? "bg-amber-500/10" : "bg-foreground/5"
              }`}
            >
              {isUrgent && <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-amber-500" />}
              <span className="text-foreground/70">Next earnings:</span>
              <span className="font-medium text-foreground">
                {new Date(`${data.nextEarningsDate}T00:00:00Z`).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
              <span className={isUrgent ? "font-medium text-amber-500" : "text-foreground/60"}>
                ({formatCountdown(daysUntil)})
              </span>
            </div>
          ) : (
            <p className="text-sm text-foreground/60">No upcoming earnings date available.</p>
          )}

          {chartData.length > 0 ? (
            <div className="h-40 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.15} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} width={32} />
                  <Tooltip
                    formatter={(value, name) => [`$${Number(value).toFixed(2)}`, String(name)]}
                    labelFormatter={(label, payload) => {
                      const surprise = payload?.[0]?.payload?.surprisePercent;
                      return typeof surprise === "number"
                        ? `${label} (${surprise >= 0 ? "+" : ""}${surprise.toFixed(1)}% surprise)`
                        : label;
                    }}
                  />
                  <Bar dataKey="estimate" name="Estimate" fill="#94a3b8" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="actual" name="Actual" radius={[2, 2, 0, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell
                        key={index}
                        fill={entry.beat === null ? "#94a3b8" : entry.beat ? "#22c55e" : "#ef4444"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-sm text-foreground/60">No earnings history available.</p>
          )}
        </>
      )}
    </div>
  );
}
