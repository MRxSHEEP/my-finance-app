"use client";

import { useEffect, useState } from "react";
import TickerAutocompleteInput from "@/components/TickerAutocompleteInput";
import { cardClass } from "@/lib/cardStyles";

interface RestrictedEntry {
  id: string;
  ticker: string;
  companyName: string | null;
  notes?: string | null;
  addedByUserId?: string;
  addedAt?: string;
  removedByUserId?: string | null;
  removedAt?: string | null;
}

interface RestrictedListTabProps {
  canManage: boolean;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export default function RestrictedListTab({ canManage }: RestrictedListTabProps) {
  const [entries, setEntries] = useState<RestrictedEntry[] | null>(null);
  const [ticker, setTicker] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Bumped after adding/removing an entry, to re-run the effect below —
  // mirrors SimulatedPortfolioDetailView.tsx's refreshToken idiom.
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const res = await fetch("/api/compliance/restricted-list");
      const body = await res.json().catch(() => null);
      if (!cancelled && res.ok) setEntries(body?.entries ?? []);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [refreshToken]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!ticker.trim()) return setError("Ticker is required");

    setSubmitting(true);
    try {
      const res = await fetch("/api/compliance/restricted-list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker, companyName: companyName || undefined, notes: notes || undefined }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) return setError(body?.error ?? "Failed to add ticker");

      setTicker("");
      setCompanyName("");
      setNotes("");
      setRefreshToken((t) => t + 1);
    } catch {
      setError("Failed to add ticker");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRemove(id: string) {
    await fetch(`/api/compliance/restricted-list/${id}`, { method: "DELETE" });
    setRefreshToken((t) => t + 1);
  }

  const current = entries?.filter((e) => !e.removedAt) ?? [];
  const removed = entries?.filter((e) => e.removedAt) ?? [];

  return (
    <div className="flex flex-col gap-4">
      {canManage && (
        <form onSubmit={handleAdd} className={cardClass("indigo", { extra: "flex flex-col gap-3 p-4" })}>
          <h3 className="text-sm font-semibold text-foreground">Add a restricted ticker</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <TickerAutocompleteInput value={ticker} onChange={setTicker} />
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Company name (optional)"
              className="w-full rounded-md border border-black/10 bg-transparent px-3 py-2 text-sm outline-none focus:border-blue-400/50 dark:border-white/15 dark:focus:border-blue-400/50"
            />
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Reason (optional)"
              className="w-full rounded-md border border-black/10 bg-transparent px-3 py-2 text-sm outline-none focus:border-blue-400/50 dark:border-white/15 dark:focus:border-blue-400/50"
            />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="self-start rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50"
          >
            Add to restricted list
          </button>
        </form>
      )}

      <div className={cardClass("neutral", { extra: "flex flex-col gap-3 p-4" })}>
        <h3 className="text-sm font-semibold text-foreground">Current restricted list</h3>
        {current.length === 0 ? (
          <p className="text-sm text-foreground/50">No tickers are currently restricted.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {current.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-2 rounded-md border border-black/10 p-2 text-sm dark:border-white/15">
                <div>
                  <span className="font-medium text-foreground">{e.ticker}</span>
                  {e.companyName && <span className="ml-2 text-foreground/50">{e.companyName}</span>}
                  {canManage && e.notes && <span className="ml-2 text-foreground/40">— {e.notes}</span>}
                  {canManage && e.addedAt && (
                    <span className="ml-2 text-xs text-foreground/40">added {formatDate(e.addedAt)}</span>
                  )}
                </div>
                {canManage && (
                  <button
                    type="button"
                    onClick={() => handleRemove(e.id)}
                    className="rounded-md border border-red-500/30 px-2 py-1 text-xs font-medium text-red-500 hover:bg-red-500/10"
                  >
                    Remove
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {canManage && removed.length > 0 && (
        <div className={cardClass("neutral", { extra: "flex flex-col gap-3 p-4" })}>
          <h3 className="text-sm font-semibold text-foreground">Removal history</h3>
          <ul className="flex flex-col gap-2 text-sm text-foreground/50">
            {removed.map((e) => (
              <li key={e.id}>
                {e.ticker} — removed {e.removedAt ? formatDate(e.removedAt) : ""}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
