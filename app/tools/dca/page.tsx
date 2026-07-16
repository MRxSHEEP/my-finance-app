"use client";

import { useState } from "react";
import ToolCard from "@/components/tools/ToolCard";
import NumberField from "@/components/tools/NumberField";
import PortfolioChart from "@/components/tools/PortfolioChart";
import { formatCurrency, formatPercent, toNumber } from "@/lib/format";

type HistoryPoint = { date: string; close: number };
type Frequency = "weekly" | "monthly";

// Generates each investment date from start to end (inclusive) at the
// given frequency. Dates are advanced in UTC to avoid DST-related drift.
function generateInvestmentDates(start: Date, end: Date, frequency: Frequency): Date[] {
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
function findCloseOnOrBefore(history: HistoryPoint[], target: Date): number | null {
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

export default function DcaSimulatorPage() {
  const [ticker, setTicker] = useState("AAPL");
  const [amount, setAmount] = useState("500");
  const [frequency, setFrequency] = useState<Frequency>("monthly");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryPoint[] | null>(null);
  const [resolvedTicker, setResolvedTicker] = useState<string | null>(null);
  const [appliedFrequency, setAppliedFrequency] = useState<Frequency>("monthly");
  const [appliedAmount, setAppliedAmount] = useState(0);
  const [appliedStart, setAppliedStart] = useState("");
  const [appliedEnd, setAppliedEnd] = useState("");

  async function handleSimulate() {
    const amountNum = toNumber(amount);

    if (!ticker.trim() || !startDate || !endDate || amountNum <= 0) {
      setError("Please fill in ticker, a positive amount, and both dates.");
      return;
    }
    if (new Date(startDate).getTime() >= new Date(endDate).getTime()) {
      setError("Start date must be before end date.");
      return;
    }

    setLoading(true);
    setError(null);
    setHistory(null);

    try {
      const res = await fetch(
        `/api/stock/history?ticker=${encodeURIComponent(
          ticker.trim()
        )}&start=${startDate}&end=${endDate}`
      );
      const body = await res.json();

      if (!res.ok) {
        setError(body.error ?? "Failed to fetch historical data");
        return;
      }

      if (!Array.isArray(body.history) || body.history.length === 0) {
        setError("No historical data available for this ticker and date range");
        return;
      }

      setHistory(body.history);
      setResolvedTicker(body.ticker ?? ticker.trim().toUpperCase());
      setAppliedFrequency(frequency);
      setAppliedAmount(amountNum);
      setAppliedStart(startDate);
      setAppliedEnd(endDate);
    } catch {
      setError("Failed to fetch historical data");
    } finally {
      setLoading(false);
    }
  }

  let totalInvested = 0;
  let totalShares = 0;
  let currentValue = 0;
  const chartPoints: { date: string; value: number }[] = [];

  if (history && history.length > 0) {
    const investmentDates = generateInvestmentDates(
      new Date(appliedStart),
      new Date(appliedEnd),
      appliedFrequency
    ).filter((d) => d.getTime() >= new Date(history[0].date).getTime());

    const periods: { date: Date; shares: number }[] = [];
    for (const date of investmentDates) {
      const price = findCloseOnOrBefore(history, date);
      if (price === null || price <= 0) continue;
      periods.push({ date, shares: appliedAmount / price });
    }

    totalInvested = periods.length * appliedAmount;
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

  const overallReturnPct =
    totalInvested > 0 ? ((currentValue - totalInvested) / totalInvested) * 100 : null;

  return (
    <main className="flex flex-1 flex-col items-center gap-6 p-8 pt-16">
      <h1 className="text-3xl font-bold text-foreground">DCA Simulator</h1>

      <ToolCard title="Inputs">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-foreground">Ticker Symbol</span>
            <input
              type="text"
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase())}
              className="rounded-md border border-black/10 bg-transparent px-3 py-2 text-sm outline-none focus:border-black/30 dark:border-white/15 dark:focus:border-white/30"
            />
            <span className="text-xs text-foreground/60">
              Stock or ETF ticker to simulate investing in.
            </span>
          </label>

          <NumberField
            label="Investment Amount"
            prefix="$"
            value={amount}
            onChange={setAmount}
            helperText="Fixed dollar amount invested at each interval."
          />

          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-foreground">Frequency</span>
            <select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value as Frequency)}
              className="rounded-md border border-black/10 bg-transparent px-3 py-2 text-sm outline-none focus:border-black/30 dark:border-white/15 dark:focus:border-white/30"
            >
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
            <span className="text-xs text-foreground/60">
              How often the fixed amount is invested.
            </span>
          </label>

          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-foreground">Start Date</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="rounded-md border border-black/10 bg-transparent px-3 py-2 text-sm outline-none focus:border-black/30 dark:border-white/15 dark:focus:border-white/30"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-foreground">End Date</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="rounded-md border border-black/10 bg-transparent px-3 py-2 text-sm outline-none focus:border-black/30 dark:border-white/15 dark:focus:border-white/30"
              />
            </label>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSimulate}
          disabled={loading}
          className="mt-4 rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "Simulating…" : "Simulate"}
        </button>

        {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
      </ToolCard>

      {history && history.length > 0 && (
        <ToolCard title={`Results — ${resolvedTicker}`}>
          <dl className="grid grid-cols-2 gap-y-2">
            <dt className="text-foreground/60">Total Invested</dt>
            <dd className="text-right">{formatCurrency(totalInvested)}</dd>
            <dt className="text-foreground/60">Total Shares</dt>
            <dd className="text-right">{totalShares.toFixed(4)}</dd>
            <dt className="text-foreground/60">Current Value</dt>
            <dd className="text-right">{formatCurrency(currentValue)}</dd>
            <dt className="font-semibold text-foreground">Overall Return</dt>
            <dd
              className={`text-right font-semibold ${
                overallReturnPct !== null && overallReturnPct >= 0
                  ? "text-green-500"
                  : "text-red-500"
              }`}
            >
              {overallReturnPct !== null ? formatPercent(overallReturnPct) : "—"}
            </dd>
          </dl>

          {chartPoints.length > 1 && (
            <div className="mt-4 h-64 w-full">
              <PortfolioChart data={chartPoints} />
            </div>
          )}
        </ToolCard>
      )}

      <p className="w-full max-w-2xl text-xs text-foreground/60">
        This is an educational estimation tool, not investment advice.
      </p>
    </main>
  );
}
