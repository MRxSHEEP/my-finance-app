"use client";

import { useState } from "react";

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

interface PreclearanceTableProps {
  requests: PreclearanceRequestRow[];
  showEmployeeColumn?: boolean;
  // Present only on the Compliance Officer/Admin "Pending Requests" tab —
  // its absence is what keeps this same table read-only in the Employee view.
  onDecide?: (id: string, decision: "approved" | "denied") => Promise<void>;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-amber-400/10 text-amber-400",
  approved: "bg-green-500/10 text-green-500",
  denied: "bg-red-500/10 text-red-500",
};

export default function PreclearanceTable({ requests, showEmployeeColumn = false, onDecide }: PreclearanceTableProps) {
  const [decidingId, setDecidingId] = useState<string | null>(null);

  if (requests.length === 0) {
    return <p className="p-4 text-sm text-foreground/50">No pre-clearance requests yet.</p>;
  }

  async function handleDecide(id: string, decision: "approved" | "denied") {
    if (!onDecide) return;
    setDecidingId(id);
    try {
      await onDecide(id, decision);
    } finally {
      setDecidingId(null);
    }
  }

  return (
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
            {onDecide && <th className="p-2 text-right">Decision</th>}
          </tr>
        </thead>
        <tbody>
          {requests.map((r) => (
            <tr key={r.id} className="border-b border-black/5 last:border-0 dark:border-white/10">
              {showEmployeeColumn && (
                <td className="p-2 text-foreground/80">{r.user?.name ?? r.user?.email ?? "—"}</td>
              )}
              <td className="p-2 font-medium text-foreground">{r.ticker}</td>
              <td className={`p-2 capitalize ${r.transactionType === "buy" ? "text-green-500" : "text-red-500"}`}>
                {r.transactionType}
              </td>
              <td className="p-2 text-right text-foreground/80">{r.quantity.toLocaleString()}</td>
              <td className="p-2 text-foreground/80">{formatDate(r.proposedTradeDate)}</td>
              <td className="p-2">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_STYLE[r.status] ?? ""}`}>
                  {r.status}
                </span>
              </td>
              {onDecide && (
                <td className="p-2 text-right">
                  {r.status === "pending" ? (
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        disabled={decidingId === r.id}
                        onClick={() => handleDecide(r.id, "approved")}
                        className="rounded-md border border-green-500/30 px-2 py-1 text-xs font-medium text-green-500 transition-colors hover:bg-green-500/10 disabled:opacity-50"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        disabled={decidingId === r.id}
                        onClick={() => handleDecide(r.id, "denied")}
                        className="rounded-md border border-red-500/30 px-2 py-1 text-xs font-medium text-red-500 transition-colors hover:bg-red-500/10 disabled:opacity-50"
                      >
                        Deny
                      </button>
                    </div>
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
  );
}
