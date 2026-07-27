"use client";

import { useEffect, useState } from "react";
import { History } from "lucide-react";
import { cardClass } from "@/lib/cardStyles";
import { DEMO_AUDIT_ENTRIES, DEMO_NEW_AUDIT_ENTRY } from "@/components/compliance/preview/sampleData";

const NEW_ENTRY_DELAY_MS = 1800;

// Mirrors AuditLogTab.tsx's table markup/classes (filters omitted — nothing
// here is dynamic enough to filter). The new row reuses the app's existing
// nav-item-fade-in keyframe (app/globals.css) rather than adding a
// near-identical one just for this scene. The cardClass + icon+header
// wrapper is the one addition beyond that real markup — every other scene
// in this walkthrough wraps its content the same way, and this was the one
// scene left as a bare table with no card, reading as visually disconnected
// from the rest.
export default function AuditLogScene() {
  // Fresh mount each time this scene becomes active (the parent keys its
  // wrapper on scene index), so the "false" initial value here already
  // covers the reset — no need to also set it inside the effect below.
  const [showNew, setShowNew] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowNew(true), NEW_ENTRY_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  const rows = showNew ? [DEMO_NEW_AUDIT_ENTRY, ...DEMO_AUDIT_ENTRIES] : DEMO_AUDIT_ENTRIES;

  return (
    <div className={cardClass("neutral", { extra: "flex flex-col gap-3 p-4" })}>
      <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
        <History size={15} className="text-foreground/40" />
        Audit log
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[500px] text-sm">
          <thead>
            <tr className="border-b border-black/10 text-xs text-foreground/50 dark:border-white/15">
              <th className="p-2 text-left">When</th>
              <th className="p-2 text-left">Actor</th>
              <th className="p-2 text-left">Action</th>
              <th className="p-2 text-left">Ticker</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((entry) => (
              <tr
                key={entry.id}
                className={`border-b border-black/5 last:border-0 dark:border-white/10 ${
                  entry.id === DEMO_NEW_AUDIT_ENTRY.id ? "animate-nav-item-fade-in motion-reduce:animate-none" : ""
                }`}
              >
                <td className="p-2 text-foreground/50">{entry.whenLabel}</td>
                <td className="p-2 text-foreground/80">{entry.actor}</td>
                <td className="p-2 capitalize text-foreground/80">{entry.action}</td>
                <td className="p-2 font-medium text-foreground">{entry.ticker}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
