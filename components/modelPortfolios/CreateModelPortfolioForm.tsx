"use client";

import { useState } from "react";
import { cardClass } from "@/lib/cardStyles";
import { WEIGHT_SUM_EPSILON } from "@/lib/modelPortfolios/constants";
import ModelPortfolioHoldingsEditor, { type HoldingRow } from "@/components/modelPortfolios/ModelPortfolioHoldingsEditor";

const EMPTY_ROW: HoldingRow = { assetType: "stock", symbol: "", targetWeightPercent: "" };

export default function CreateModelPortfolioForm({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState("");
  const [rows, setRows] = useState<HoldingRow[]>([EMPTY_ROW]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim()) return setError("Name is required.");

    const holdings = rows.map((r) => ({
      assetType: r.assetType,
      symbol: r.symbol.trim().toUpperCase(),
      targetWeightPercent: Number(r.targetWeightPercent),
    }));
    if (holdings.some((h) => !h.symbol || !Number.isFinite(h.targetWeightPercent) || h.targetWeightPercent <= 0)) {
      return setError("Every holding needs a symbol and a positive weight.");
    }
    const weightSum = holdings.reduce((s, h) => s + h.targetWeightPercent, 0);
    if (Math.abs(weightSum - 100) > WEIGHT_SUM_EPSILON) {
      return setError(`Target weights must sum to 100% (currently ${weightSum.toFixed(2)}%).`);
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/model-portfolios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), holdings }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) return setError(body?.error ?? "Failed to create model portfolio");

      setName("");
      setRows([EMPTY_ROW]);
      onCreated();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className={cardClass("indigo", { extra: "flex flex-col gap-3 p-4" })}>
      <h3 className="text-sm font-semibold text-foreground">New model portfolio</h3>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-foreground">Name</span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Conservative Growth"
          className="w-full max-w-sm rounded-md border border-black/10 bg-transparent px-3 py-2 text-sm outline-none focus:border-blue-400/50 dark:border-white/15 dark:focus:border-blue-400/50"
        />
      </label>

      <ModelPortfolioHoldingsEditor rows={rows} onChange={setRows} />

      {error && <p className="text-sm text-red-500">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="self-start rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50"
      >
        {submitting ? "Creating…" : "Create"}
      </button>
    </form>
  );
}
