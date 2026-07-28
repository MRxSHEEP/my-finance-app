"use client";

import { useState } from "react";
import { ChevronDown, Sparkles } from "lucide-react";
import ScrollHint from "@/components/ScrollHint";

interface PreclearanceRequestRow {
  id: string;
  ticker: string;
  proposedTradeDate: string;
  transactionType: string;
  quantity: number;
  status: string;
  notes: string | null;
  decisionNotes: string | null;
  createdAt: string;
  user?: { name: string | null; email: string } | null;
}

interface AiReviewResult {
  flag: boolean;
  rationale: string;
  suggestedNote: string;
}

interface PreclearanceTableProps {
  requests: PreclearanceRequestRow[];
  showEmployeeColumn?: boolean;
  // Present only on the Compliance Officer/Admin "Pending Requests" tab —
  // its absence is what keeps this same table read-only in the Employee view.
  onDecide?: (id: string, decision: "approved" | "denied", decisionNotes: string | null) => Promise<void>;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-amber-400/10 text-amber-400",
  approved: "bg-green-500/10 text-green-500",
  denied: "bg-red-500/10 text-red-500",
};

// Collapsed-by-default AI-Assisted Review (Compliance Copilot), plus the
// (also new) decision-notes textarea and the real Approve/Deny actions —
// all scoped to one pending request. The AI call is read-only and never
// persists anything on its own; the textarea is local component state
// until Approve/Deny is clicked, which is the one action that actually
// writes to the record — whether its notes came from the AI suggestion,
// an edited version of it, or something the officer typed without ever
// running the assist at all.
function PendingRequestControls({
  request,
  deciding,
  onDecide,
}: {
  request: PreclearanceRequestRow;
  deciding: boolean;
  onDecide: (id: string, decision: "approved" | "denied", decisionNotes: string | null) => Promise<void>;
}) {
  const [notes, setNotes] = useState("");
  const [aiOpen, setAiOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<AiReviewResult | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  async function runAiReview() {
    setAiLoading(true);
    setAiError(null);
    try {
      const response = await fetch(`/api/compliance/preclearance/${request.id}/ai-review`, { method: "POST" });
      const body = await response.json().catch(() => null);
      if (!response.ok || !body) {
        setAiError(body?.error ?? "AI review is unavailable right now.");
        return;
      }
      setAiResult(body);
    } catch {
      setAiError("AI review is unavailable right now.");
    } finally {
      setAiLoading(false);
    }
  }

  return (
    <div className="flex w-full flex-col gap-2 text-left">
      <div className="rounded-md border border-black/10 dark:border-white/15">
        <button
          type="button"
          onClick={() => setAiOpen((v) => !v)}
          aria-expanded={aiOpen}
          className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs font-medium text-foreground transition-colors hover:bg-foreground/5"
        >
          <span className="flex items-center gap-1.5">
            <Sparkles size={13} className="text-indigo-400" />
            AI-Assisted Review
          </span>
          <ChevronDown size={14} className={`shrink-0 text-foreground/40 transition-transform duration-200 ${aiOpen ? "rotate-180" : ""}`} />
        </button>
        <div className="grid transition-all duration-200 ease-out" style={{ gridTemplateRows: aiOpen ? "1fr" : "0fr" }}>
          <div className="overflow-hidden">
            <div className="flex flex-col gap-2 border-t border-black/10 p-3 text-xs dark:border-white/15">
              {!aiResult && (
                <button
                  type="button"
                  onClick={runAiReview}
                  disabled={aiLoading}
                  className="self-start rounded-md border border-indigo-400/30 px-2.5 py-1.5 text-xs font-medium text-indigo-400 transition-colors hover:bg-indigo-400/10 disabled:opacity-50"
                >
                  {aiLoading ? "Analyzing…" : "Run AI Review"}
                </button>
              )}
              {aiError && <p className="text-red-500">{aiError}</p>}
              {aiResult && (
                <div className="flex flex-col gap-2">
                  <span
                    className={`w-fit rounded-full px-2 py-0.5 text-xs font-medium ${
                      aiResult.flag ? "bg-amber-400/10 text-amber-500" : "bg-green-500/10 text-green-500"
                    }`}
                  >
                    {aiResult.flag ? "Flagged for review" : "No concerns identified"}
                  </span>
                  <p className="leading-relaxed text-foreground/70">{aiResult.rationale}</p>
                  <button type="button" onClick={() => setNotes(aiResult.suggestedNote)} className="self-start text-indigo-400 hover:underline">
                    Use suggested note →
                  </button>
                  <p className="text-[10px] italic text-foreground/40">
                    AI-generated draft for review only — not a compliance determination. Edit or discard as you see fit.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <label className="flex flex-col gap-1 text-xs text-foreground/60">
        Decision notes (optional)
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Add notes for this decision — your own, or edited/accepted from the AI suggestion above."
          className="w-full rounded-md border border-black/10 bg-transparent px-2 py-1.5 text-xs text-foreground outline-none dark:border-white/15"
        />
      </label>

      <div className="flex justify-end gap-1">
        <button
          type="button"
          disabled={deciding}
          onClick={() => onDecide(request.id, "approved", notes.trim() || null)}
          className="rounded-md border border-green-500/30 px-2 py-1 text-xs font-medium text-green-500 transition-colors hover:bg-green-500/10 disabled:opacity-50"
        >
          Approve
        </button>
        <button
          type="button"
          disabled={deciding}
          onClick={() => onDecide(request.id, "denied", notes.trim() || null)}
          className="rounded-md border border-red-500/30 px-2 py-1 text-xs font-medium text-red-500 transition-colors hover:bg-red-500/10 disabled:opacity-50"
        >
          Deny
        </button>
      </div>
    </div>
  );
}

export default function PreclearanceTable({ requests, showEmployeeColumn = false, onDecide }: PreclearanceTableProps) {
  const [decidingId, setDecidingId] = useState<string | null>(null);

  if (requests.length === 0) {
    return <p className="p-4 text-sm text-foreground/50">No pre-clearance requests yet.</p>;
  }

  async function handleDecide(id: string, decision: "approved" | "denied", decisionNotes: string | null) {
    if (!onDecide) return;
    setDecidingId(id);
    try {
      await onDecide(id, decision, decisionNotes);
    } finally {
      setDecidingId(null);
    }
  }

  return (
    <>
      <ScrollHint />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[700px] text-sm">
          <thead>
            <tr className="border-b border-black/10 text-xs text-foreground/50 dark:border-white/15">
              {showEmployeeColumn && <th className="p-2 text-left">Employee</th>}
              <th className="p-2 text-left">Ticker</th>
              <th className="p-2 text-left">Type</th>
              <th className="p-2 text-right">Quantity</th>
              <th className="p-2 text-left">Proposed date</th>
              <th className="p-2 text-left">Status</th>
              {onDecide && <th className="p-2 text-left">Decision</th>}
            </tr>
          </thead>
          <tbody>
            {requests.map((r) => (
              <tr key={r.id} className="border-b border-black/5 last:border-0 dark:border-white/10">
                {showEmployeeColumn && (
                  <td className="p-2 align-top text-foreground/80">{r.user?.name ?? r.user?.email ?? "—"}</td>
                )}
                <td className="p-2 align-top font-medium text-foreground">{r.ticker}</td>
                <td className={`p-2 align-top capitalize ${r.transactionType === "buy" ? "text-green-500" : "text-red-500"}`}>
                  {r.transactionType}
                </td>
                <td className="p-2 align-top text-right text-foreground/80">{r.quantity.toLocaleString()}</td>
                <td className="p-2 align-top text-foreground/80">{formatDate(r.proposedTradeDate)}</td>
                <td className="p-2 align-top">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_STYLE[r.status] ?? ""}`}>
                    {r.status}
                  </span>
                </td>
                {onDecide && (
                  <td className="min-w-[260px] p-2 align-top">
                    {r.status === "pending" ? (
                      <PendingRequestControls request={r} deciding={decidingId === r.id} onDecide={handleDecide} />
                    ) : (
                      <span className="text-xs text-foreground/40">{r.decisionNotes ?? "—"}</span>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
