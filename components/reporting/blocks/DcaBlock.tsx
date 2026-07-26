"use client";

import { useState } from "react";
import NumberField from "@/components/tools/NumberField";
import { formatCurrency, formatPercent, toNumber } from "@/lib/format";
import { calculateDca, type HistoryPoint, type DcaFrequency } from "@/lib/calculators/dca";

export const DCA_DEFAULTS: Record<string, string> = {
  ticker: "AAPL",
  amount: "500",
  frequency: "monthly",
  startDate: "",
  endDate: "",
};

export function toDcaInputs(values: Record<string, string>) {
  return {
    ticker: (values.ticker ?? DCA_DEFAULTS.ticker).trim().toUpperCase(),
    amount: toNumber(values.amount ?? DCA_DEFAULTS.amount),
    frequency: values.frequency === "weekly" ? "weekly" : "monthly",
    startDate: values.startDate ?? "",
    endDate: values.endDate ?? "",
  };
}

interface DcaBlockProps {
  values: Record<string, string>;
  onFieldChange: (key: string, value: string) => void;
}

// Cloned from app/tools/dca/page.tsx's input section. Unlike the other 4
// blocks, this needs a network round-trip for its preview (real historical
// prices) — a "Preview" button triggers it explicitly rather than an
// effect firing on every keystroke; the actual report PDF re-fetches this
// same history server-side from the stored ticker/dates, so this preview
// is a convenience, not the source of truth.
export default function DcaBlock({ values, onFieldChange }: DcaBlockProps) {
  const ticker = values.ticker ?? DCA_DEFAULTS.ticker;
  const amount = values.amount ?? DCA_DEFAULTS.amount;
  const frequency = (values.frequency ?? DCA_DEFAULTS.frequency) as DcaFrequency;
  const startDate = values.startDate ?? "";
  const endDate = values.endDate ?? "";

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryPoint[] | null>(null);

  async function handlePreview() {
    const amt = toNumber(amount);
    if (!ticker.trim() || !startDate || !endDate || amt <= 0) {
      setError("Fill in ticker, a positive amount, and both dates.");
      return;
    }
    if (new Date(startDate).getTime() >= new Date(endDate).getTime()) {
      setError("Start date must be before end date.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/stock/history?ticker=${encodeURIComponent(ticker.trim())}&start=${startDate}&end=${endDate}`
      );
      const body = await res.json();
      if (!res.ok || !Array.isArray(body.history) || body.history.length === 0) {
        setError(body?.error ?? "No historical data available for this ticker and date range");
        setHistory(null);
        return;
      }
      setHistory(body.history);
    } catch {
      setError("Failed to fetch historical data");
    } finally {
      setLoading(false);
    }
  }

  const result = history ? calculateDca({ amount: toNumber(amount), frequency, startDate, endDate, history }) : null;

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-foreground">Ticker Symbol</span>
          <input
            type="text"
            value={ticker}
            onChange={(e) => onFieldChange("ticker", e.target.value.toUpperCase())}
            className="rounded-md border border-black/10 bg-transparent px-3 py-2 text-sm outline-none focus:border-black/30 dark:border-white/15 dark:focus:border-white/30"
          />
        </label>

        <NumberField
          label="Investment Amount"
          prefix="$"
          value={amount}
          onChange={(v) => onFieldChange("amount", v)}
        />

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-foreground">Frequency</span>
          <select
            value={frequency}
            onChange={(e) => onFieldChange("frequency", e.target.value)}
            className="rounded-md border border-black/10 bg-transparent px-3 py-2 text-sm outline-none focus:border-black/30 dark:border-white/15 dark:focus:border-white/30"
          >
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </label>

        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-foreground">Start Date</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => onFieldChange("startDate", e.target.value)}
              className="rounded-md border border-black/10 bg-transparent px-3 py-2 text-sm outline-none focus:border-black/30 dark:border-white/15 dark:focus:border-white/30"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-foreground">End Date</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => onFieldChange("endDate", e.target.value)}
              className="rounded-md border border-black/10 bg-transparent px-3 py-2 text-sm outline-none focus:border-black/30 dark:border-white/15 dark:focus:border-white/30"
            />
          </label>
        </div>
      </div>

      <button
        type="button"
        onClick={handlePreview}
        disabled={loading}
        className="self-start rounded-md border border-black/10 px-3 py-1.5 text-xs font-medium text-foreground/70 hover:text-foreground disabled:opacity-50 dark:border-white/15"
      >
        {loading ? "Loading…" : "Preview"}
      </button>
      {error && <p className="text-xs text-red-500">{error}</p>}

      {result && (
        <dl className="grid grid-cols-2 gap-y-1 text-sm">
          <dt className="text-foreground/60">Total Invested</dt>
          <dd className="text-right">{formatCurrency(result.totalInvested)}</dd>
          <dt className="text-foreground/60">Current Value</dt>
          <dd className="text-right">{formatCurrency(result.currentValue)}</dd>
          <dt className="font-semibold text-foreground">Overall Return</dt>
          <dd
            className={`text-right font-semibold ${
              result.overallReturnPercent !== null && result.overallReturnPercent >= 0
                ? "text-green-500"
                : "text-red-500"
            }`}
          >
            {result.overallReturnPercent !== null ? formatPercent(result.overallReturnPercent) : "—"}
          </dd>
        </dl>
      )}
    </div>
  );
}
