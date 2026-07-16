"use client";

import { useEffect, useState } from "react";
import StarRating from "@/components/StarRating";

interface PriceTargetData {
  available: boolean;
  high: number | null;
  low: number | null;
  average: number | null;
}

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export default function AnalystViewCard({
  ticker,
  rating,
  ratingLabel,
  currentPrice,
}: {
  ticker: string;
  rating: number | null;
  ratingLabel: string;
  currentPrice: number | null;
}) {
  const [target, setTarget] = useState<PriceTargetData | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!cancelled) setTarget(null);
      try {
        const response = await fetch(`/api/stock/price-target?ticker=${encodeURIComponent(ticker)}`);
        if (!response.ok) throw new Error("request failed");
        const body = await response.json();
        if (!cancelled) setTarget(body);
      } catch {
        if (!cancelled) setTarget({ available: false, high: null, low: null, average: null });
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [ticker]);

  const hasRange =
    target?.available &&
    target.low != null &&
    target.high != null &&
    target.average != null &&
    target.high > target.low;

  const range = hasRange ? target!.high! - target!.low! : 0;
  const avgPercent = hasRange ? ((target!.average! - target!.low!) / range) * 100 : 0;
  const pricePercent =
    hasRange && currentPrice != null
      ? Math.min(100, Math.max(0, ((currentPrice - target!.low!) / range) * 100))
      : null;
  const impliedChangePercent =
    hasRange && currentPrice != null && currentPrice !== 0
      ? ((target!.average! - currentPrice) / currentPrice) * 100
      : null;

  return (
    <div className="flex flex-col gap-3 rounded-md border border-black/10 p-4 dark:border-white/15">
      <h3 className="font-semibold text-foreground">Analyst View</h3>

      <div className="flex items-center gap-2">
        <StarRating rating={rating} />
        <span className="text-sm font-medium text-foreground">{ratingLabel}</span>
      </div>

      {target === null && (
        <div className="h-16 w-full animate-pulse rounded bg-foreground/10" />
      )}

      {target !== null && !hasRange && (
        <p className="text-sm text-foreground/60">Price target data unavailable.</p>
      )}

      {hasRange && (
        <div className="flex flex-col gap-2">
          <div className="relative h-2 rounded-full bg-foreground/10">
            {pricePercent !== null && (
              <div
                className="absolute top-1/2 h-4 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground"
                style={{ left: `${pricePercent}%` }}
                title={`Current: ${currencyFormatter.format(currentPrice!)}`}
              />
            )}
            <div
              className="absolute top-1/2 h-4 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-500"
              style={{ left: `${avgPercent}%` }}
              title={`Average target: ${currencyFormatter.format(target!.average!)}`}
            />
          </div>
          <div className="flex justify-between text-xs text-foreground/60">
            <span>Low {currencyFormatter.format(target!.low!)}</span>
            <span className="text-indigo-500">Avg {currencyFormatter.format(target!.average!)}</span>
            <span>High {currencyFormatter.format(target!.high!)}</span>
          </div>
          {impliedChangePercent !== null && (
            <p className="text-sm">
              <span className="text-foreground/60">Implied vs. current: </span>
              <span
                className={`font-semibold ${
                  impliedChangePercent > 0
                    ? "text-green-500"
                    : impliedChangePercent < 0
                      ? "text-red-500"
                      : "text-foreground"
                }`}
              >
                {impliedChangePercent >= 0 ? "+" : ""}
                {impliedChangePercent.toFixed(1)}%
              </span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
