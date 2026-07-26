"use client";

import { useEffect, useState } from "react";
import { cardClass } from "@/lib/cardStyles";

interface InsiderMatch {
  transactionId: string;
  reportingPersonName: string | null;
  reportingPersonRole: string | null;
  transactionType: string;
  tradeDate: string | null;
  reportedDate: string | null;
  sourceUrl: string | null;
}

interface FlagDetails {
  restrictedListEntryId?: string;
  addedByUserId?: string;
  addedAt?: string;
  notes?: string | null;
  windowDays?: number;
  matches?: InsiderMatch[];
}

interface Flag {
  id: string;
  ticker: string;
  tradeDate: string;
  flagType: "restricted_list" | "insider_proximity";
  status: string;
  details: FlagDetails | null;
  createdAt: string;
  user?: { name: string | null; email: string } | null;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

const FLAG_LABEL: Record<Flag["flagType"], string> = {
  restricted_list: "Restricted list conflict",
  insider_proximity: "Near insider Form 4 activity",
};

export default function FlaggedTradesTab() {
  const [statusFilter, setStatusFilter] = useState<"open" | "reviewed">("open");
  const [flags, setFlags] = useState<Flag[] | null>(null);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  // Bumped after marking a flag reviewed, to re-run the effect below —
  // mirrors SimulatedPortfolioDetailView.tsx's refreshToken idiom.
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const res = await fetch(`/api/compliance/flags?status=${statusFilter}`);
      const body = await res.json().catch(() => null);
      if (!cancelled && res.ok) setFlags(body?.flags ?? []);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [statusFilter, refreshToken]);

  async function handleReview(id: string) {
    setReviewingId(id);
    try {
      await fetch(`/api/compliance/flags/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: "{}" });
      setRefreshToken((t) => t + 1);
    } finally {
      setReviewingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-1">
        {(["open", "reviewed"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatusFilter(s)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-colors duration-150 ease-out ${
              statusFilter === s ? "bg-indigo-500 text-white" : "text-foreground/60 hover:bg-foreground/5"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {!flags || flags.length === 0 ? (
        <p className="p-4 text-sm text-foreground/50">No {statusFilter} flags.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {flags.map((flag) => (
            <div key={flag.id} className={cardClass("indigo", { extra: "flex flex-col gap-2 p-4" })}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground">{flag.ticker}</span>
                  <span className="rounded-full bg-indigo-400/10 px-2 py-0.5 text-xs font-medium text-indigo-400">
                    {FLAG_LABEL[flag.flagType]}
                  </span>
                </div>
                {statusFilter === "open" && (
                  <button
                    type="button"
                    disabled={reviewingId === flag.id}
                    onClick={() => handleReview(flag.id)}
                    className="rounded-md border border-black/10 px-3 py-1.5 text-xs font-medium text-foreground/70 hover:text-foreground disabled:opacity-50 dark:border-white/15"
                  >
                    Mark reviewed
                  </button>
                )}
              </div>
              <p className="text-xs text-foreground/50">
                {flag.user?.name ?? flag.user?.email ?? "Unknown employee"} — trade date {formatDate(flag.tradeDate)}, flagged{" "}
                {formatDate(flag.createdAt)}
              </p>
              {flag.flagType === "restricted_list" && flag.details?.notes && (
                <p className="text-xs text-foreground/60">Reason on file: {flag.details.notes}</p>
              )}
              {flag.flagType === "insider_proximity" && flag.details?.matches && (
                <ul className="flex flex-col gap-1 text-xs text-foreground/60">
                  {flag.details.matches.map((m) => (
                    <li key={m.transactionId}>
                      {m.reportingPersonName ?? "Unnamed insider"}
                      {m.reportingPersonRole ? ` (${m.reportingPersonRole})` : ""} — {m.transactionType}{" "}
                      {m.tradeDate ? `on ${formatDate(m.tradeDate)}` : ""}
                      {m.sourceUrl && (
                        <>
                          {" "}
                          ·{" "}
                          <a href={m.sourceUrl} target="_blank" rel="noreferrer" className="underline">
                            filing
                          </a>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
