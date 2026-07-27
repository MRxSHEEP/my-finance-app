import { Ban } from "lucide-react";
import { cardClass } from "@/lib/cardStyles";
import { DEMO_RESTRICTED_ENTRIES } from "@/components/compliance/preview/sampleData";

// Mirrors the read-only rendering branch of RestrictedListTab.tsx (the
// view an employee, not a Compliance Officer, sees) — same markup/classes,
// fictional data instead of a fetch. The icon+header and per-row status
// pill are the one addition beyond that real markup, kept small enough not
// to conflict with actually mirroring the production view.
export default function RestrictedListScene() {
  return (
    <div className={cardClass("neutral", { extra: "flex flex-col gap-3 p-4" })}>
      <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
        <Ban size={15} className="text-foreground/40" />
        Current restricted list
      </h3>
      <ul className="flex flex-col gap-2">
        {DEMO_RESTRICTED_ENTRIES.map((e) => (
          <li
            key={e.id}
            className="flex items-center justify-between gap-2 rounded-md border border-black/10 p-2.5 text-sm dark:border-white/15"
          >
            <div>
              <span className="font-medium text-foreground">{e.ticker}</span>
              <span className="ml-2 text-foreground/50">{e.companyName}</span>
            </div>
            <span className="shrink-0 rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-500">
              Restricted
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
