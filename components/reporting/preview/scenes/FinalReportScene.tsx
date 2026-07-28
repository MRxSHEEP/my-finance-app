"use client";

import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { cardClass } from "@/lib/cardStyles";
import {
  DEMO_AI_COMMENTARY,
  DEMO_ADVISOR_NAME,
  DEMO_CLIENT_NAME,
  DEMO_ORG_NAME,
  DEMO_PORTFOLIO_HOLDINGS,
  DEMO_PORTFOLIO_TOTAL,
} from "@/components/reporting/preview/sampleData";

const READY_AT_MS = 900;

function formatCurrency(value: number): string {
  return `$${value.toLocaleString("en-US")}`;
}

// Top half mirrors ReportHistoryList.tsx's row markup/classes (client name,
// calculator badge, View/Download buttons — non-functional here, same
// "recreate the real UI, no fetch" convention as every scene). Bottom half
// mirrors the actual generated PDF's content (lib/reporting/pdf/ReportDocument.tsx)
// as a plain HTML preview rather than an embedded PDF — the portfolio table
// and the AI commentary + its permanent disclosure line are the two pieces
// this scene exists to show.
export default function FinalReportScene() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setReady(true), READY_AT_MS);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="flex flex-col gap-4 text-left">
      {!ready ? (
        <div className={cardClass("neutral", { extra: "flex items-center gap-2 p-4 text-sm text-foreground/60" })}>
          Generating report…
        </div>
      ) : (
        <>
          <div className={cardClass("neutral", { extra: "flex items-center justify-between gap-2 p-3 animate-nav-item-fade-in motion-reduce:animate-none" })}>
            <div>
              <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                <CheckCircle2 size={14} className="text-green-500" />
                {DEMO_CLIENT_NAME}
              </p>
              <p className="text-xs text-foreground/50">DCF · Simulated Portfolio · Just now</p>
            </div>
            <div className="flex gap-2">
              <span className="rounded-md border border-black/10 px-2 py-1 text-xs font-medium text-foreground/70 dark:border-white/15">
                View
              </span>
              <span className="rounded-md border border-black/10 px-2 py-1 text-xs font-medium text-foreground/70 dark:border-white/15">
                Download
              </span>
            </div>
          </div>

          <div className="animate-nav-item-fade-in motion-reduce:animate-none rounded-lg border border-black/10 bg-background p-4 text-xs dark:border-white/15">
            <div className="mb-2 h-1 w-full rounded-full bg-indigo-500" />
            <p className="font-semibold text-foreground">{DEMO_ORG_NAME}</p>
            <p className="text-foreground/50">Prepared by {DEMO_ADVISOR_NAME}</p>
            <p className="mt-2 text-sm font-bold text-foreground">Client Report — {DEMO_CLIENT_NAME}</p>

            <p className="mt-3 font-semibold text-foreground">Simulated Portfolio</p>
            <table className="mt-1 w-full">
              <tbody>
                {DEMO_PORTFOLIO_HOLDINGS.map((h) => (
                  <tr key={h.symbol} className="border-t border-black/5 dark:border-white/10">
                    <td className="py-1 text-foreground/70">
                      {h.symbol} — {h.name}
                    </td>
                    <td className="py-1 text-right text-foreground">{formatCurrency(h.value)}</td>
                    <td className="py-1 text-right text-foreground/50">{h.percent}%</td>
                  </tr>
                ))}
                <tr className="border-t border-black/20 font-semibold dark:border-white/20">
                  <td className="py-1 text-foreground">Total Portfolio Value</td>
                  <td className="py-1 text-right text-foreground" colSpan={2}>
                    {formatCurrency(DEMO_PORTFOLIO_TOTAL)}
                  </td>
                </tr>
              </tbody>
            </table>

            <p className="mt-3 font-semibold text-foreground">Portfolio Commentary</p>
            <p className="mt-1 leading-relaxed text-foreground/70">
              {DEMO_AI_COMMENTARY.draft}
              {DEMO_AI_COMMENTARY.editedAddition}
            </p>
            <p className="mt-1 italic text-foreground/40">
              This commentary was drafted with AI assistance and reviewed and approved by your advisor before
              inclusion in this report.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
