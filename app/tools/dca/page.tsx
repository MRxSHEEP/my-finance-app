"use client";

import { useState } from "react";
import Link from "next/link";
import { BookOpen } from "lucide-react";
import { CONCEPT_VISUALS, CONCEPT_COLOR_CLASSES } from "@/lib/conceptVisuals";
import ToolCard from "@/components/tools/ToolCard";
import NumberField from "@/components/tools/NumberField";
import PortfolioChart from "@/components/tools/PortfolioChart";
import AnimatedNumber from "@/components/tools/AnimatedNumber";
import HowItWorksAccordion from "@/components/tools/HowItWorksAccordion";
import LoadExampleButton from "@/components/tools/LoadExampleButton";
import DisclaimerCallout from "@/components/tools/DisclaimerCallout";
import { formatCurrency, formatPercent, toNumber } from "@/lib/format";
import { calculateDca, type HistoryPoint, type DcaFrequency } from "@/lib/calculators/dca";

type Frequency = DcaFrequency;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function isoYearsAgo(years: number): string {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() - years);
  return d.toISOString().slice(0, 10);
}

const EXAMPLE = {
  ticker: "AAPL",
  amount: "500",
  frequency: "monthly" as Frequency,
  startDate: isoYearsAgo(5),
  endDate: todayIso(),
};

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

  const amountNum = toNumber(amount);
  const amountError = amount.trim() && amountNum <= 0 ? "Must be a positive amount." : undefined;
  const dateOrderError =
    startDate && endDate && new Date(startDate).getTime() >= new Date(endDate).getTime()
      ? "Start date must be before end date."
      : undefined;

  async function runSimulation(
    simTicker: string,
    simAmount: string,
    simFrequency: Frequency,
    simStart: string,
    simEnd: string
  ) {
    const amt = toNumber(simAmount);
    if (!simTicker.trim() || !simStart || !simEnd || amt <= 0) {
      setError("Please fill in ticker, a positive amount, and both dates.");
      return;
    }
    if (new Date(simStart).getTime() >= new Date(simEnd).getTime()) {
      setError("Start date must be before end date.");
      return;
    }

    setLoading(true);
    setError(null);
    setHistory(null);

    try {
      const res = await fetch(
        `/api/stock/history?ticker=${encodeURIComponent(simTicker.trim())}&start=${simStart}&end=${simEnd}`
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
      setResolvedTicker(body.ticker ?? simTicker.trim().toUpperCase());
      setAppliedFrequency(simFrequency);
      setAppliedAmount(amt);
      setAppliedStart(simStart);
      setAppliedEnd(simEnd);
    } catch {
      setError("Failed to fetch historical data");
    } finally {
      setLoading(false);
    }
  }

  function handleSimulate() {
    runSimulation(ticker, amount, frequency, startDate, endDate);
  }

  function loadExample() {
    setTicker(EXAMPLE.ticker);
    setAmount(EXAMPLE.amount);
    setFrequency(EXAMPLE.frequency);
    setStartDate(EXAMPLE.startDate);
    setEndDate(EXAMPLE.endDate);
    runSimulation(EXAMPLE.ticker, EXAMPLE.amount, EXAMPLE.frequency, EXAMPLE.startDate, EXAMPLE.endDate);
  }

  const { totalInvested, totalShares, currentValue, overallReturnPercent: overallReturnPct, chartPoints } =
    history && history.length > 0
      ? calculateDca({
          amount: appliedAmount,
          frequency: appliedFrequency,
          startDate: appliedStart,
          endDate: appliedEnd,
          history,
        })
      : { totalInvested: 0, totalShares: 0, currentValue: 0, overallReturnPercent: null, chartPoints: [] };

  const { icon: Icon, color } = CONCEPT_VISUALS.dca;
  const iconColorClass = CONCEPT_COLOR_CLASSES[color].icon;

  return (
    <main className="flex flex-1 flex-col items-center gap-6 p-8 pt-16">
      <div className="flex w-full max-w-2xl items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon className={iconColorClass} size={26} />
          <h1 className="text-3xl font-bold text-foreground">DCA Simulator</h1>
        </div>
        <Link
          href="/learning/dca"
          className="flex items-center gap-1 text-xs text-foreground/60 hover:text-foreground hover:underline"
        >
          <BookOpen size={12} /> Learn about DCA
        </Link>
      </div>

      <ToolCard title="Inputs">
        <div className="mb-4 flex items-center justify-between">
          <span className="text-xs text-foreground/50">Real historical prices — press Simulate to run.</span>
          <LoadExampleButton onClick={loadExample} />
        </div>
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
            error={amountError}
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
          {dateOrderError && <p className="col-span-full text-xs text-red-500">{dateOrderError}</p>}
        </div>

        <button
          type="button"
          onClick={handleSimulate}
          disabled={loading}
          className="mt-4 rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "Simulating…" : "Simulate"}
        </button>

        {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
      </ToolCard>

      {history && history.length > 0 && (
        <ToolCard title={`Results — ${resolvedTicker}`}>
          <dl className="grid grid-cols-2 gap-y-2">
            <dt className="text-foreground/60">Total Invested</dt>
            <dd className="text-right">
              <AnimatedNumber value={totalInvested} format={(v) => formatCurrency(v)} />
            </dd>
            <dt className="text-foreground/60">Total Shares</dt>
            <dd className="text-right">{totalShares.toFixed(4)}</dd>
            <dt className="text-foreground/60">Current Value</dt>
            <dd className="text-right">
              <AnimatedNumber value={currentValue} format={(v) => formatCurrency(v)} />
            </dd>
            <dt className="font-semibold text-foreground">Overall Return</dt>
            <dd
              className={`text-right font-semibold ${
                overallReturnPct !== null && overallReturnPct >= 0
                  ? "text-green-500"
                  : "text-red-500"
              }`}
            >
              {overallReturnPct !== null ? (
                <AnimatedNumber value={overallReturnPct} format={(v) => formatPercent(v)} />
              ) : (
                "—"
              )}
            </dd>
          </dl>

          {chartPoints.length > 1 && (
            <div className="mt-4 h-64 w-full">
              <PortfolioChart data={chartPoints} />
            </div>
          )}
        </ToolCard>
      )}

      <HowItWorksAccordion>
        <p>
          Dollar-cost averaging (DCA) invests a fixed dollar amount at regular intervals,
          regardless of price — buying more shares when the price is low and fewer when it&apos;s
          high, which averages out your cost basis over time instead of betting on a single entry
          point.
        </p>
        <p>
          This simulator replays real historical closing prices for your chosen ticker, buying at
          the nearest available close on or after each scheduled investment date, then compares
          your total invested to the current value of everything you&apos;d have accumulated.
        </p>
      </HowItWorksAccordion>

      <DisclaimerCallout>
        This is an educational estimation tool, not investment advice. Past performance
        doesn&apos;t predict future returns, and this simulation ignores taxes, fees, and dividends
        unless they&apos;re already reflected in the price history.
      </DisclaimerCallout>
    </main>
  );
}
