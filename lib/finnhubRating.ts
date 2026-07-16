interface RecommendationTrend {
  strongBuy?: number;
  buy?: number;
  hold?: number;
  sell?: number;
  strongSell?: number;
}

// Shared by app/api/stock/overview/route.ts and app/api/stock/peers/route.ts
// — a weighted average of the most recent analyst recommendation
// distribution, on a 1 (Strong Sell) to 5 (Strong Buy) scale.
export function computeRatingFromTrend(latest: RecommendationTrend | null): number | null {
  if (!latest) return null;

  const strongBuy = latest.strongBuy ?? 0;
  const buy = latest.buy ?? 0;
  const hold = latest.hold ?? 0;
  const sell = latest.sell ?? 0;
  const strongSell = latest.strongSell ?? 0;
  const total = strongBuy + buy + hold + sell + strongSell;
  if (total === 0) return null;

  return (strongBuy * 5 + buy * 4 + hold * 3 + sell * 2 + strongSell * 1) / total;
}

export function ratingToLabel(rating: number | null): string {
  if (rating === null) return "N/A";
  switch (Math.round(rating)) {
    case 5:
      return "Strong Buy";
    case 4:
      return "Buy";
    case 3:
      return "Hold";
    case 2:
      return "Sell";
    case 1:
      return "Strong Sell";
    default:
      return "N/A";
  }
}
