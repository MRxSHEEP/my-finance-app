// Parses a controlled-input string into a finite number, defaulting to 0
// for empty/invalid input rather than propagating NaN through calculations.
export function toNumber(value: string): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function formatCurrency(value: number, decimals = 2): string {
  if (!Number.isFinite(value)) return "—";
  const sign = value < 0 ? "-" : "";
  return `${sign}$${Math.abs(value).toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

// Formats large dollar amounts with K/M/B suffixes (e.g. $1.25M).
export function formatCompactCurrency(value: number): string {
  if (!Number.isFinite(value)) return "—";
  const sign = value < 0 ? "-" : "";
  return `${sign}$${new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(Math.abs(value))}`;
}

export function formatPercent(value: number, decimals = 2): string {
  if (!Number.isFinite(value)) return "—";
  return `${value.toFixed(decimals)}%`;
}

export function formatRatio(value: number, decimals = 2): string {
  if (!Number.isFinite(value)) return "—";
  return value.toFixed(decimals);
}
