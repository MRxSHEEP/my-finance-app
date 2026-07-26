// Extracted verbatim from app/tools/dca/page.tsx's inline calculation.
// Unlike the other 4 calculators, DCA isn't pure client-side math — it
// depends on historical price data, so `history` is caller-supplied here
// rather than fetched inside (the page fetches via GET /api/stock/history;
// the Reporting PDF route fetches server-side via the same
// resolveTickerSymbol/fetchHistoryWithFallback functions that route itself
// calls — see app/api/stock/history/route.ts).
export type HistoryPoint = { date: string; close: number };
export type DcaFrequency = "weekly" | "monthly";

export interface DcaInputs {
  amount: number;
  frequency: DcaFrequency;
  startDate: string;
  endDate: string;
  history: HistoryPoint[];
}

export interface DcaResult {
  totalInvested: number;
  totalShares: number;
  currentValue: number;
  overallReturnPercent: number | null;
  chartPoints: { date: string; value: number }[];
}

// Generates each investment date from start to end (inclusive) at the
// given frequency. Dates are advanced in UTC to avoid DST-related drift.
export function generateInvestmentDates(start: Date, end: Date, frequency: DcaFrequency): Date[] {
  const dates: Date[] = [];
  const current = new Date(start);

  while (current.getTime() <= end.getTime()) {
    dates.push(new Date(current));
    if (frequency === "weekly") {
      current.setUTCDate(current.getUTCDate() + 7);
    } else {
      current.setUTCMonth(current.getUTCMonth() + 1);
    }
  }

  return dates;
}

// Finds the most recent close on or before the target date (markets
// aren't open every day, so an investment date may not have its own bar).
export function findCloseOnOrBefore(history: HistoryPoint[], target: Date): number | null {
  let result: number | null = null;
  for (const point of history) {
    if (new Date(point.date).getTime() <= target.getTime()) {
      result = point.close;
    } else {
      break;
    }
  }
  return result;
}

export function calculateDca({ amount, frequency, startDate, endDate, history }: DcaInputs): DcaResult {
  let totalInvested = 0;
  let totalShares = 0;
  let currentValue = 0;
  const chartPoints: { date: string; value: number }[] = [];

  if (history.length > 0) {
    const investmentDates = generateInvestmentDates(new Date(startDate), new Date(endDate), frequency).filter(
      (d) => d.getTime() >= new Date(history[0].date).getTime()
    );

    const periods: { date: Date; shares: number }[] = [];
    for (const date of investmentDates) {
      const price = findCloseOnOrBefore(history, date);
      if (price === null || price <= 0) continue;
      periods.push({ date, shares: amount / price });
    }

    totalInvested = periods.length * amount;
    totalShares = periods.reduce((sum, p) => sum + p.shares, 0);

    const lastClose = history[history.length - 1].close;
    currentValue = totalShares * lastClose;

    let cumulativeShares = 0;
    let periodIndex = 0;
    for (const point of history) {
      const pointTime = new Date(point.date).getTime();
      while (periodIndex < periods.length && periods[periodIndex].date.getTime() <= pointTime) {
        cumulativeShares += periods[periodIndex].shares;
        periodIndex++;
      }
      if (cumulativeShares > 0) {
        chartPoints.push({ date: point.date, value: cumulativeShares * point.close });
      }
    }
  }

  const overallReturnPercent =
    totalInvested > 0 ? ((currentValue - totalInvested) / totalInvested) * 100 : null;

  return { totalInvested, totalShares, currentValue, overallReturnPercent, chartPoints };
}
