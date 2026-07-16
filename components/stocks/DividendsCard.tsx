"use client";

import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

interface DividendPoint {
  date: string;
  amount: number;
}

interface DividendData {
  hasDividends: boolean;
  lastExDate: string | null;
  annualDividendPerShare: number | null;
  history: DividendPoint[];
}

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export default function DividendsCard({
  ticker,
  currentPrice,
}: {
  ticker: string;
  currentPrice: number | null;
}) {
  const [data, setData] = useState<DividendData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!cancelled) {
        setData(null);
        setError(null);
      }
      try {
        const response = await fetch(`/api/stock/dividends?ticker=${encodeURIComponent(ticker)}`);
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

  const yieldPercent =
    data?.hasDividends && data.annualDividendPerShare != null && currentPrice
      ? (data.annualDividendPerShare / currentPrice) * 100
      : null;

  const chartData = (data?.history ?? []).map((point) => ({
    label: new Date(`${point.date}T00:00:00Z`).toLocaleDateString("en-US", {
      month: "short",
      year: "2-digit",
    }),
    amount: point.amount,
  }));

  return (
    <div className="flex flex-col gap-3 rounded-md border border-black/10 p-4 dark:border-white/15">
      <h3 className="font-semibold text-foreground">Dividends</h3>

      {!data && !error && <div className="h-32 w-full animate-pulse rounded bg-foreground/10" />}

      {error && <p className="text-sm text-foreground/60">Data unavailable</p>}

      {data && !data.hasDividends && (
        <p className="text-sm text-foreground/60">No dividend history.</p>
      )}

      {data?.hasDividends && (
        <>
          <div className="flex gap-6 text-sm">
            <div>
              <span className="block text-xs text-foreground/50">Yield</span>
              <span className="font-semibold text-foreground">
                {yieldPercent !== null ? `${yieldPercent.toFixed(2)}%` : "—"}
              </span>
            </div>
            <div>
              <span className="block text-xs text-foreground/50">Last Ex-Date</span>
              <span className="font-semibold text-foreground">
                {data.lastExDate
                  ? new Date(`${data.lastExDate}T00:00:00Z`).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })
                  : "—"}
              </span>
            </div>
          </div>

          <div className="h-32 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.15} />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10 }} width={32} />
                <Tooltip formatter={(value) => [currencyFormatter.format(Number(value)), "Dividend"]} />
                <Bar dataKey="amount" fill="#22c55e" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
}
