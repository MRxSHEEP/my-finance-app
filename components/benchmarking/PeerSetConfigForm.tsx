"use client";

import { useState } from "react";
import { cardClass } from "@/lib/cardStyles";
import TickerAutocompleteInput from "@/components/TickerAutocompleteInput";

const MAX_PEERS = 6;

interface PeerSetConfigFormProps {
  initialOwnCompanyTicker: string | null;
  initialPeers: string[];
  onSaved: () => void;
}

// Own-company ticker + repeatable peer-ticker rows, capped at 6 — mirrors
// components/modelPortfolios/ModelPortfolioHoldingsEditor.tsx's
// add/remove-row pattern, simplified to a bare ticker string per row (no
// weights — this is a peer LIST, not an allocation).
export default function PeerSetConfigForm({ initialOwnCompanyTicker, initialPeers, onSaved }: PeerSetConfigFormProps) {
  const [ownCompanyTicker, setOwnCompanyTicker] = useState(initialOwnCompanyTicker ?? "");
  const [peerRows, setPeerRows] = useState<string[]>(initialPeers.length > 0 ? initialPeers : [""]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function updateRow(index: number, value: string) {
    setPeerRows((rows) => rows.map((r, i) => (i === index ? value.toUpperCase() : r)));
  }

  function addRow() {
    if (peerRows.length >= MAX_PEERS) return;
    setPeerRows((rows) => [...rows, ""]);
  }

  function removeRow(index: number) {
    setPeerRows((rows) => rows.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const peers = peerRows.map((r) => r.trim().toUpperCase()).filter(Boolean);
    const ownTicker = ownCompanyTicker.trim().toUpperCase();

    if (!ownTicker && peers.length === 0) {
      return setError("Set an own-company ticker, at least one peer, or both.");
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/benchmarking/peer-set", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ownCompanyTicker: ownTicker || undefined, peers }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) return setError(body?.error ?? "Failed to save peer set");
      onSaved();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className={cardClass("indigo", { extra: "flex w-full max-w-2xl flex-col gap-4 p-4" })}>
      <h2 className="text-lg font-semibold text-foreground">Configure Peer Set</h2>

      <label className="flex max-w-xs flex-col gap-1">
        <span className="text-sm font-medium text-foreground">Your company&apos;s ticker (optional)</span>
        <TickerAutocompleteInput value={ownCompanyTicker} onChange={setOwnCompanyTicker} placeholder="e.g. AAPL" />
      </label>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-foreground">Peer tickers (up to {MAX_PEERS})</span>
        {peerRows.map((row, i) => (
          <div key={i} className="flex items-center gap-2">
            <TickerAutocompleteInput
              value={row}
              onChange={(value) => updateRow(i, value)}
              placeholder="Ticker"
              className="w-40 rounded-md border border-black/10 bg-transparent px-3 py-2 text-sm outline-none dark:border-white/15"
            />
            <button
              type="button"
              onClick={() => removeRow(i)}
              className="rounded-md border border-black/10 px-2 py-1 text-xs text-foreground/50 hover:text-foreground dark:border-white/15"
            >
              Remove
            </button>
          </div>
        ))}
        {peerRows.length < MAX_PEERS && (
          <button type="button" onClick={addRow} className="self-start text-xs text-indigo-400 hover:underline">
            + Add peer
          </button>
        )}
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="self-start rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50"
      >
        {submitting ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
