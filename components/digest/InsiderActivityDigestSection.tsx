"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { UserSearch } from "lucide-react";
import RevealOnScroll from "@/components/RevealOnScroll";

interface InsiderActivityEntry {
  ticker: string | null;
  entityName: string;
  reportingPersonName: string | null;
  transactionType: string;
  shares: number | null;
  exactValue: number | null;
  disclosureDate: string | null;
}

const compactCurrencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

function formatTransactionType(type: string): string {
  switch (type) {
    case "buy":
      return "Bought";
    case "sell":
      return "Sold";
    case "option_exercise":
      return "Exercised options";
    case "gift":
      return "Gifted";
    case "award":
      return "Awarded";
    case "tax_withholding":
      return "Tax withholding";
    default:
      return "Other";
  }
}

// Reuses lib/trackers/byTicker.ts's getRecentInsiderActivity — a read-only
// query over already-ingested TrackerTransaction rows (lib/trackers/insiderForm4.ts
// owns ingestion). Congress trading is NOT part of this build (see the
// plan's own note) — this query is separately, explicitly filtered to
// insider_form4/type:"insider" only, so nothing congress-related can
// surface here even indirectly.
export default function InsiderActivityDigestSection() {
  const [entries, setEntries] = useState<InsiderActivityEntry[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch("/api/trackers/recent-insider-activity?limit=6");
        const body = await response.json().catch(() => null);
        if (cancelled) return;
        if (!response.ok || !Array.isArray(body?.entries)) {
          setError(true);
          return;
        }
        setEntries(body.entries);
      } catch {
        if (!cancelled) setError(true);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <RevealOnScroll className="flex w-full flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <UserSearch size={20} className="text-indigo-400" />
          <h2 className="text-2xl font-bold text-white">Notable Insider Activity</h2>
        </div>
        <Link href="/trackers" className="text-sm text-white/50 hover:text-white/80">
          All trackers →
        </Link>
      </div>

      <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
        {entries ? (
          entries.length > 0 ? (
            <div className="flex flex-col gap-2">
              {entries.map((entry, index) => (
                <div key={index} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    {entry.ticker && <span className="font-semibold text-white">{entry.ticker}</span>}
                    <span className="text-white/60">
                      {entry.reportingPersonName ?? "An insider"} {formatTransactionType(entry.transactionType).toLowerCase()}
                      {entry.shares != null ? ` ${entry.shares.toLocaleString(undefined, { maximumFractionDigits: 0 })} shares` : ""}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-3 text-xs text-white/50">
                    {entry.exactValue != null && <span>{compactCurrencyFormatter.format(entry.exactValue)}</span>}
                    {entry.disclosureDate && (
                      <span>{new Date(entry.disclosureDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-white/50">No recent insider activity to show.</p>
          )
        ) : error ? (
          <p className="text-sm text-white/50">Insider activity is temporarily unavailable.</p>
        ) : (
          <div className="flex flex-col gap-3" aria-hidden="true">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-4 w-full animate-pulse rounded bg-white/10" />
            ))}
          </div>
        )}
      </div>
    </RevealOnScroll>
  );
}
