"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ClipboardCheck, Sparkles } from "lucide-react";
import { cardClass } from "@/lib/cardStyles";
import { DEMO_AI_REVIEW, DEMO_PRECLEARANCE_REQUEST } from "@/components/compliance/preview/sampleData";

// Timeline (ms from mount) for the fully self-playing sequence: the
// accordion opens, "runs" the AI review, the officer's suggested note gets
// used, then the request is approved. A visitor can also short-circuit any
// step by clicking it themselves — the accordion toggle, "Run AI Review",
// "Use suggested note", and Approve/Deny all work for real — same
// interactive-but-self-playing spirit this scene always had.
const EXPAND_AT_MS = 900;
const ANALYZING_AT_MS = 1300;
const RESULT_AT_MS = 2600;
const USE_NOTE_AT_MS = 4600;
const APPROVE_AT_MS = 5600;
const MANUAL_ANALYSIS_MS = 1200;

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-amber-400/10 text-amber-400",
  approved: "bg-green-500/10 text-green-500",
  denied: "bg-red-500/10 text-red-500",
};

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

// Mirrors PreclearanceTable.tsx's row + AI-Assisted Review accordion
// markup/classes exactly, but as a bespoke recreation rather than the real
// component — that component now makes a real, authenticated fetch when
// "Run AI Review" is clicked (see components/compliance/PreclearanceTable.tsx's
// Compliance Copilot integration), which a signed-out visitor could never
// actually complete. Every state change here is local and scripted instead,
// same as every other scene in this walkthrough (see AuditLogScene.tsx).
export default function PreclearanceScene() {
  // Fresh mount each time this scene becomes active (the parent keys its
  // wrapper on scene index), so these initial values already cover the
  // reset — no need to also reset them inside the effect below.
  const [status, setStatus] = useState<"pending" | "approved" | "denied">("pending");
  const [aiOpen, setAiOpen] = useState(false);
  const [aiPhase, setAiPhase] = useState<"idle" | "analyzing" | "result">("idle");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    const timers = [
      setTimeout(() => setAiOpen(true), EXPAND_AT_MS),
      setTimeout(() => setAiPhase("analyzing"), ANALYZING_AT_MS),
      setTimeout(() => setAiPhase("result"), RESULT_AT_MS),
      setTimeout(() => setNotes(DEMO_AI_REVIEW.suggestedNote), USE_NOTE_AT_MS),
      setTimeout(() => setStatus("approved"), APPROVE_AT_MS),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  function runAnalysis() {
    setAiPhase("analyzing");
    setTimeout(() => setAiPhase("result"), MANUAL_ANALYSIS_MS);
  }

  const request = DEMO_PRECLEARANCE_REQUEST;
  const decisionNotes =
    status === "pending" ? null : notes.trim() || (status === "approved" ? "Approved — no restricted list conflict" : "Denied");

  return (
    <div className={cardClass("neutral", { extra: "flex flex-col gap-3 p-4" })}>
      <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
        <ClipboardCheck size={15} className="text-foreground/40" />
        Pending pre-clearance requests
      </h3>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[700px] text-sm">
          <thead>
            <tr className="border-b border-black/10 text-xs text-foreground/50 dark:border-white/15">
              <th className="p-2 text-left">Employee</th>
              <th className="p-2 text-left">Ticker</th>
              <th className="p-2 text-left">Type</th>
              <th className="p-2 text-right">Quantity</th>
              <th className="p-2 text-left">Proposed date</th>
              <th className="p-2 text-left">Status</th>
              <th className="p-2 text-left">Decision</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-black/5 last:border-0 dark:border-white/10">
              <td className="p-2 align-top text-foreground/80">{request.user.name}</td>
              <td className="p-2 align-top font-medium text-foreground">{request.ticker}</td>
              <td
                className={`p-2 align-top capitalize ${
                  request.transactionType === "buy" ? "text-green-500" : "text-red-500"
                }`}
              >
                {request.transactionType}
              </td>
              <td className="p-2 align-top text-right text-foreground/80">{request.quantity.toLocaleString()}</td>
              <td className="p-2 align-top text-foreground/80">{formatDate(request.proposedTradeDate)}</td>
              <td className="p-2 align-top">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_STYLE[status]}`}>
                  {status}
                </span>
              </td>
              <td className="min-w-[260px] p-2 align-top">
                {status === "pending" ? (
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
                        <ChevronDown
                          size={14}
                          className={`shrink-0 text-foreground/40 transition-transform duration-200 ${aiOpen ? "rotate-180" : ""}`}
                        />
                      </button>
                      <div
                        className="grid transition-all duration-200 ease-out"
                        style={{ gridTemplateRows: aiOpen ? "1fr" : "0fr" }}
                      >
                        <div className="overflow-hidden">
                          <div className="flex flex-col gap-2 border-t border-black/10 p-3 text-xs dark:border-white/15">
                            {aiPhase === "idle" && (
                              <button
                                type="button"
                                onClick={runAnalysis}
                                className="self-start rounded-md border border-indigo-400/30 px-2.5 py-1.5 text-xs font-medium text-indigo-400 transition-colors hover:bg-indigo-400/10"
                              >
                                Run AI Review
                              </button>
                            )}
                            {aiPhase === "analyzing" && (
                              <button
                                type="button"
                                disabled
                                className="self-start rounded-md border border-indigo-400/30 px-2.5 py-1.5 text-xs font-medium text-indigo-400 opacity-50"
                              >
                                Analyzing…
                              </button>
                            )}
                            {aiPhase === "result" && (
                              <div className="flex flex-col gap-2 animate-nav-item-fade-in motion-reduce:animate-none">
                                <span
                                  className={`w-fit rounded-full px-2 py-0.5 text-xs font-medium ${
                                    DEMO_AI_REVIEW.flag ? "bg-amber-400/10 text-amber-500" : "bg-green-500/10 text-green-500"
                                  }`}
                                >
                                  {DEMO_AI_REVIEW.flag ? "Flagged for review" : "No concerns identified"}
                                </span>
                                <p className="leading-relaxed text-foreground/70">{DEMO_AI_REVIEW.rationale}</p>
                                <button
                                  type="button"
                                  onClick={() => setNotes(DEMO_AI_REVIEW.suggestedNote)}
                                  className="self-start text-indigo-400 hover:underline"
                                >
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
                        onClick={() => setStatus("approved")}
                        className="rounded-md border border-green-500/30 px-2 py-1 text-xs font-medium text-green-500 transition-colors hover:bg-green-500/10"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => setStatus("denied")}
                        className="rounded-md border border-red-500/30 px-2 py-1 text-xs font-medium text-red-500 transition-colors hover:bg-red-500/10"
                      >
                        Deny
                      </button>
                    </div>
                  </div>
                ) : (
                  <span className="text-xs text-foreground/40">{decisionNotes ?? "—"}</span>
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
