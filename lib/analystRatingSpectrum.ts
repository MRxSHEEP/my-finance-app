// Shared by components/stocks/AnalystViewCard.tsx — maps the existing 1
// (Strong Sell) to 5 (Strong Buy) weighted analyst rating (see
// lib/finnhubRating.ts's computeRatingFromTrend) onto a continuous 5-tier
// "Sell now" -> "Good buy" spectrum, and derives a buy/sell strength
// percentage and an illustrative price target from that same rating.
// Visual-only concern — none of this touches how the rating itself is
// computed or fetched.

export interface RatingTier {
  label: string;
  // Tailwind text color for this tier's label, matching this app's
  // existing green=buy/red=sell/slate=hold convention (see
  // AnalystViewCard.tsx's BREAKDOWN_SEGMENTS gradient stops).
  textColorClass: string;
}

export const RATING_TIERS: RatingTier[] = [
  { label: "Sell now", textColorClass: "text-red-500" },
  { label: "Moderate sell", textColorClass: "text-amber-500" },
  { label: "Fair", textColorClass: "text-slate-400" },
  { label: "Moderate buy", textColorClass: "text-green-400" },
  { label: "Good buy", textColorClass: "text-green-500" },
];

// The gradient behind the spectrum bar itself — red -> amber -> gray ->
// light green -> green, matching RATING_TIERS in the same order. Raw hex
// (not Tailwind's bg-gradient-to-r) since that utility only supports 2-3
// stops via from/via/to, not the 5 needed here.
export const RATING_SPECTRUM_GRADIENT =
  "linear-gradient(to right, #ef4444, #f59e0b, #94a3b8, #86efac, #22c55e)";

const RATING_MIN = 1;
const RATING_MAX = 5;

// Rescales the 1-5 weighted rating onto a 0-100 spectrum. This same
// percentage drives both the marker's position along the bar and the
// displayed "78% buy consensus" figure — they're the same underlying
// quantity, 0% meaning unanimous Strong Sell and 100% meaning unanimous
// Strong Buy. Equivalent to averaging each analyst's call on a
// {Strong Sell: 0, Sell: 25, Hold: 50, Buy: 75, Strong Buy: 100} scale,
// since that scale is just this same linear rescale applied per-analyst
// before averaging (rescaling commutes with averaging).
export function ratingToPercent(rating: number): number {
  const clamped = Math.min(RATING_MAX, Math.max(RATING_MIN, rating));
  return ((clamped - RATING_MIN) / (RATING_MAX - RATING_MIN)) * 100;
}

// 5 equal 20%-wide bands across that same 0-100 spectrum: 0-20% Sell now,
// 20-40% Moderate sell, 40-60% Fair, 60-80% Moderate buy, 80-100% Good buy.
export function getRatingTier(rating: number): RatingTier {
  const percent = ratingToPercent(rating);
  const index = Math.min(RATING_TIERS.length - 1, Math.floor(percent / 20));
  return RATING_TIERS[index];
}

// A modest, symmetric adjustment off current price when no real analyst
// price target exists for a ticker: +/-10% at the spectrum's extremes,
// 0% at exactly Fair (50%). This is a simple illustrative model, not a
// real target — callers must always visibly label it as such.
const MAX_ILLUSTRATIVE_ADJUSTMENT = 0.1;

export function computeIllustrativePriceTarget(currentPrice: number, ratingPercent: number): number {
  const signedStrength = (ratingPercent - 50) / 50; // -1 (Sell now) .. +1 (Good buy)
  return currentPrice * (1 + signedStrength * MAX_ILLUSTRATIVE_ADJUSTMENT);
}
