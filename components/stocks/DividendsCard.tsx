"use client";

import { useEffect, useId, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { cardClass } from "@/lib/cardStyles";
import { useInViewOnce } from "@/lib/useInViewOnce";
import { AnimatedBarShape } from "./AnimatedBarShape";

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

interface DividendChartPoint {
  label: string;
  fullDate: string;
  amount: number;
}

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

// Matches EarningsCard's own custom tooltip treatment — rounded, blurred,
// ring-bordered — instead of recharts' plain default box, and shows the
// exact ex-dividend date rather than just the axis tick's "MMM 'YY" label.
function DividendsTooltipContent({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: DividendChartPoint }>;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0].payload;

  return (
    <div className="rounded-md border border-black/10 bg-background/95 px-3 py-2 text-xs shadow-lg ring-1 ring-black/5 backdrop-blur-sm dark:border-white/15 dark:ring-white/10">
      <p className="mb-1 font-semibold text-foreground">{point.fullDate}</p>
      <p className="text-foreground/70">
        Dividend: <span className="font-medium text-green-500">{currencyFormatter.format(point.amount)}</span>
      </p>
    </div>
  );
}

export default function DividendsCard({
  ticker,
  currentPrice,
}: {
  ticker: string;
  currentPrice: number | null;
}) {
  const [data, setData] = useState<DividendData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { ref: chartRef, visible: chartVisible } = useInViewOnce<HTMLDivElement>();
  const gradientId = `dividends-amount-${useId().replace(/:/g, "")}`;

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

  const chartData: DividendChartPoint[] = (data?.history ?? []).map((point) => {
    const date = new Date(`${point.date}T00:00:00Z`);
    return {
      label: date.toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
      fullDate: date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      amount: point.amount,
    };
  });

  return (
    <div className={cardClass("neutral", { extra: "flex flex-col gap-3 p-4" })}>
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

          <div ref={chartRef} className="h-32 w-full">
            {chartVisible && (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <defs>
                    <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#4ade80" />
                      <stop offset="100%" stopColor="#16a34a" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.06} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10 }}
                    interval="preserveStartEnd"
                    tickLine={false}
                    axisLine={{ opacity: 0.15 }}
                  />
                  <YAxis tick={{ fontSize: 10 }} width={32} tickLine={false} axisLine={{ opacity: 0.15 }} />
                  <Tooltip content={<DividendsTooltipContent />} cursor={{ fill: "rgba(34,197,94,0.06)" }} />
                  <Bar
                    dataKey="amount"
                    fill={`url(#${gradientId})`}
                    shape={AnimatedBarShape}
                    isAnimationActive={false}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </>
      )}
    </div>
  );
}
