import { AlertTriangle } from "lucide-react";
import { cardClass } from "@/lib/cardStyles";
import { DEMO_FLAG } from "@/components/compliance/preview/sampleData";

// Mirrors FlaggedTradesTab.tsx's tab bar + per-flag card markup/classes for
// a single "insider_proximity" flag, tying back to the trade disclosed in
// DisclosureScene. The soft animated ring (animate-flag-glow, see
// app/globals.css) is the one addition beyond that real markup — this is
// the single scene meant to visually read as "this got caught," so it's
// the one card in the whole walkthrough that draws the eye on its own
// rather than waiting to be read.
export default function FlagScene() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-1">
        <span className="rounded-md bg-indigo-500 px-3 py-1.5 text-sm font-medium text-white">Open</span>
        <span className="rounded-md px-3 py-1.5 text-sm font-medium text-foreground/60">Reviewed</span>
      </div>

      <div className={cardClass("indigo", { extra: "flex flex-col gap-2 p-4 animate-flag-glow motion-reduce:animate-none" })}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle size={15} className="text-indigo-400" />
            <span className="font-semibold text-foreground">{DEMO_FLAG.ticker}</span>
            <span className="rounded-full bg-indigo-400/10 px-2 py-0.5 text-xs font-medium text-indigo-400">
              Near insider Form 4 activity
            </span>
          </div>
          <span className="rounded-md border border-black/10 px-3 py-1.5 text-xs font-medium text-foreground/40 dark:border-white/15">
            Mark reviewed
          </span>
        </div>
        <p className="text-xs text-foreground/50">
          {DEMO_FLAG.employeeName} — trade date {DEMO_FLAG.tradeDateLabel}, flagged {DEMO_FLAG.flaggedDateLabel}
        </p>
        <ul className="flex flex-col gap-1 text-xs text-foreground/60">
          <li>
            {DEMO_FLAG.insiderName} ({DEMO_FLAG.insiderRole}) — {DEMO_FLAG.insiderTransactionType} on{" "}
            {DEMO_FLAG.insiderTradeDateLabel}
          </li>
        </ul>
      </div>
    </div>
  );
}
