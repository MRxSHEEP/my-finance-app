"use client";

import { useState } from "react";
import TickerAutocompleteInput from "@/components/TickerAutocompleteInput";
import NumberField from "@/components/tools/NumberField";
import { cardClass } from "@/lib/cardStyles";

type Mode = "disclosure" | "preclearance";

interface TradeReportFormProps {
  mode: Mode;
  onSubmitted?: () => void;
}

// Disclosure ({ticker, tradeDate, transactionType, quantity, notes}) and
// pre-clearance ({ticker, proposedTradeDate, transactionType, quantity,
// notes}) requests share ~90% of the same fields — one form with a mode
// switch avoids duplicating that markup across two near-identical files.
export default function TradeReportForm({ mode, onSubmitted }: TradeReportFormProps) {
  const [ticker, setTicker] = useState("");
  const [tradeDate, setTradeDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [transactionType, setTransactionType] = useState<"buy" | "sell">("buy");
  const [quantity, setQuantity] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ flagCount: number } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const quantityNum = Number(quantity);
    if (!ticker.trim()) return setError("Ticker is required");
    if (!Number.isFinite(quantityNum) || quantityNum <= 0) return setError("Quantity must be a positive number");

    setSubmitting(true);
    try {
      const endpoint = mode === "disclosure" ? "/api/compliance/disclosures" : "/api/compliance/preclearance";
      const body =
        mode === "disclosure"
          ? { ticker, tradeDate, transactionType, quantity: quantityNum, notes: notes || undefined }
          : { ticker, proposedTradeDate: tradeDate, transactionType, quantity: quantityNum, notes: notes || undefined };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const responseBody = await res.json().catch(() => null);
      if (!res.ok) {
        setError(responseBody?.error ?? "Failed to submit — try again.");
        return;
      }

      setResult({ flagCount: Array.isArray(responseBody?.flags) ? responseBody.flags.length : 0 });
      setTicker("");
      setQuantity("");
      setNotes("");
      onSubmitted?.();
    } catch {
      setError("Failed to submit — try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className={cardClass("indigo", { extra: "flex flex-col gap-4 p-4" })}>
      <h3 className="text-sm font-semibold text-foreground">
        {mode === "disclosure" ? "Report a trade" : "Request pre-clearance"}
      </h3>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-foreground">Ticker</span>
          <TickerAutocompleteInput value={ticker} onChange={setTicker} />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-foreground">
            {mode === "disclosure" ? "Trade date" : "Proposed trade date"}
          </span>
          <input
            type="date"
            value={tradeDate}
            onChange={(e) => setTradeDate(e.target.value)}
            className="w-full rounded-md border border-black/10 bg-transparent px-3 py-2 text-sm outline-none transition-colors duration-200 ease-out focus:border-blue-400/50 dark:border-white/15 dark:focus:border-blue-400/50"
          />
        </label>

        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-foreground">Type</span>
          <div className="flex gap-2">
            {(["buy", "sell"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTransactionType(t)}
                className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium capitalize transition-colors duration-150 ease-out ${
                  transactionType === t
                    ? "border-indigo-400/50 bg-indigo-400/10 text-indigo-400"
                    : "border-black/10 text-foreground/60 hover:bg-foreground/5 dark:border-white/15"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <NumberField label="Quantity" value={quantity} onChange={setQuantity} placeholder="100" />
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-foreground">Notes (optional)</span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="w-full rounded-md border border-black/10 bg-transparent px-3 py-2 text-sm outline-none transition-colors duration-200 ease-out focus:border-blue-400/50 dark:border-white/15 dark:focus:border-blue-400/50"
        />
      </label>

      {error && <p className="text-sm text-red-500">{error}</p>}
      {result && (
        <p className="text-sm text-green-500">
          {mode === "disclosure" ? "Trade disclosed." : "Pre-clearance request submitted."}
          {result.flagCount > 0
            ? ` ${result.flagCount} compliance flag${result.flagCount > 1 ? "s" : ""} raised for review.`
            : " No conflicts found."}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="self-start rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {submitting ? "Submitting…" : mode === "disclosure" ? "Submit disclosure" : "Request pre-clearance"}
      </button>
    </form>
  );
}
