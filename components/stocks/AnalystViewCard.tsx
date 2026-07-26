"use client";

import { useEffect, useState } from "react";
import { Target, TrendingUp, TrendingDown, Minus, Info } from "lucide-react";
import { cardClass } from "@/lib/cardStyles";
import {
  RATING_SPECTRUM_GRADIENT,
  ratingToPercent,
  getRatingTier,
  computeIllustrativePriceTarget,
} from "@/lib/analystRatingSpectrum";

interface PriceTargetData {
  available: boolean;
  high: number | null;
  low: number | null;
  average: number | null;
}

interface RecommendationBreakdown {
  period: string | null;
  strongBuy: number;
  buy: number;
  hold: number;
  sell: number;
  strongSell: number;
}

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

// A visible rating swing between two consecutive months, below which the
// difference is just float noise from the weighted-average formula (a
// single analyst dropping "buy" for "strongBuy" shifts the 1-5 average by
// a few hundredths) rather than a genuine, worth-reporting shift in
// consensus.
const TREND_NOISE_FLOOR = 0.15;

function formatRecommendationPeriod(period: string | null): string {
  if (!period) return "last month";
  return new Date(`${period}T00:00:00Z`).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

// Supporting detail only (see RatingSpectrum for the primary visual) — a
// row of small stat cards for the raw Strong Buy/Buy/Hold/Sell/Strong Sell
// counts behind the spectrum, plus the analyst count and reporting period.
const BREAKDOWN_SEGMENTS: Array<{ key: keyof RecommendationBreakdown; label: string }> = [
  { key: "strongBuy", label: "Strong Buy" },
  { key: "buy", label: "Buy" },
  { key: "hold", label: "Hold" },
  { key: "sell", label: "Sell" },
  { key: "strongSell", label: "Strong Sell" },
];

function RecommendationBreakdownStats({ breakdown }: { breakdown: RecommendationBreakdown }) {
  const total =
    breakdown.strongBuy + breakdown.buy + breakdown.hold + breakdown.sell + breakdown.strongSell;
  if (total === 0) return null;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="grid grid-cols-5 gap-1.5">
        {BREAKDOWN_SEGMENTS.map((segment) => (
          <div
            key={segment.key}
            className="flex flex-col items-center gap-0.5 rounded-md bg-foreground/5 px-1 py-1.5 text-center"
          >
            <span className="text-[9px] leading-tight text-foreground/50">{segment.label}</span>
            <span className="text-sm font-semibold text-foreground">{breakdown[segment.key] as number}</span>
          </div>
        ))}
      </div>
      <p className="text-center text-xs text-foreground/40">
        {total} analyst{total === 1 ? "" : "s"}, {formatRecommendationPeriod(breakdown.period)}
      </p>
    </div>
  );
}

function RecommendationTrend({
  rating,
  previousRating,
  previousPeriod,
}: {
  rating: number | null;
  previousRating: number | null;
  previousPeriod: string | null;
}) {
  if (rating === null || previousRating === null) return null;
  const diff = rating - previousRating;

  if (Math.abs(diff) < TREND_NOISE_FLOOR) {
    return (
      <p className="flex items-center gap-1.5 text-xs text-foreground/50">
        <Minus size={12} /> Consensus unchanged from {formatRecommendationPeriod(previousPeriod)}
      </p>
    );
  }

  const improving = diff > 0;
  return (
    <p className={`flex items-center gap-1.5 text-xs font-medium ${improving ? "text-green-500" : "text-red-500"}`}>
      {improving ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
      Consensus {improving ? "improved" : "declined"} since {formatRecommendationPeriod(previousPeriod)}
    </p>
  );
}

// The primary visual: a continuous red -> amber -> gray -> light green ->
// green gradient spanning the 1 (Strong Sell) to 5 (Strong Buy) rating
// scale, with a marker showing exactly where consensus falls, the
// resulting tier label ("Moderate buy"), and the same position expressed
// as a 0-100% buy/sell strength score.
function RatingSpectrum({ rating }: { rating: number | null }) {
  if (rating === null) {
    return (
      <div className="flex flex-col gap-1.5">
        <span className="text-lg font-bold text-foreground/40">No rating available</span>
        <div className="h-3 w-full rounded-full bg-foreground/10" />
      </div>
    );
  }

  const percent = ratingToPercent(rating);
  const tier = getRatingTier(rating);

  return (
    <div className="flex flex-col gap-1.5">
      <span className={`text-lg font-bold ${tier.textColorClass}`}>
        {tier.label}
        <span className="ml-1.5 text-sm font-semibold text-foreground/60">{Math.round(percent)}%</span>
      </span>

      <div className="relative h-3 w-full rounded-full" style={{ background: RATING_SPECTRUM_GRADIENT }}>
        <div
          className="absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-background bg-foreground shadow-md"
          style={{ left: `${percent}%` }}
          title={`${tier.label} — ${Math.round(percent)}%`}
        />
      </div>

      <div className="flex justify-between text-[9px] uppercase tracking-wide text-foreground/40">
        <span>Sell now</span>
        <span>Fair</span>
        <span>Good buy</span>
      </div>
    </div>
  );
}

export default function AnalystViewCard({
  ticker,
  rating,
  currentPrice,
  recommendationBreakdown = null,
  previousRating = null,
  previousPeriod = null,
}: {
  ticker: string;
  rating: number | null;
  ratingLabel: string;
  currentPrice: number | null;
  recommendationBreakdown?: RecommendationBreakdown | null;
  previousRating?: number | null;
  previousPeriod?: string | null;
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

  // Illustrative-only fallback, shown solely when no real price target
  // exists — never in the same slot a genuine target occupies, and always
  // paired with its own explicit "not a reported price target" label.
  const illustrativeTarget =
    !hasRange && rating !== null && currentPrice != null
      ? computeIllustrativePriceTarget(currentPrice, ratingToPercent(rating))
      : null;

  return (
    <div className={cardClass("neutral", { extra: "flex flex-col gap-3 p-4" })}>
      <h3 className="font-semibold text-foreground">Analyst View</h3>

      <RatingSpectrum rating={rating} />
      <RecommendationTrend rating={rating} previousRating={previousRating} previousPeriod={previousPeriod} />

      {recommendationBreakdown && <RecommendationBreakdownStats breakdown={recommendationBreakdown} />}

      {target === null && (
        <div className="h-16 w-full animate-pulse rounded bg-foreground/10" />
      )}

      {target !== null && !hasRange && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 rounded-md bg-foreground/5 px-3 py-2 text-sm text-foreground/50">
            <Target size={16} className="shrink-0 text-foreground/30" />
            <span>Price target data unavailable for this ticker.</span>
          </div>
          {illustrativeTarget !== null && (
            <div className="flex items-center gap-2 rounded-md border border-dashed border-foreground/15 px-3 py-2 text-xs text-foreground/50">
              <Info size={14} className="shrink-0 text-foreground/30" />
              <span>
                Est. price target{" "}
                <span className="font-medium text-foreground/70">{currencyFormatter.format(illustrativeTarget)}</span>{" "}
                — based on analyst sentiment, not a reported price target.
              </span>
            </div>
          )}
        </div>
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
