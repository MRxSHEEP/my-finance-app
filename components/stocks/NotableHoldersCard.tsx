"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { cardClass } from "@/lib/cardStyles";

interface Holder {
  slug: string;
  name: string;
  type: string;
  title: string | null;
  shares: number | null;
  estimatedValue: number | null;
  isEstimate: boolean;
  asOfDate: string;
}

interface ActivityEntry {
  entitySlug: string;
  entityName: string;
  entityType: string;
  transactionType: string;
  reportedDate: string | null;
  disclosureDate: string | null;
  reportingPersonName: string | null;
  sourceUrl: string | null;
}

interface NotableHoldersData {
  congressHolderCount: number;
  hedgeFundHolderCount: number;
  recentInsiderTransactionCount: number;
  holders: Holder[];
  recentActivity: ActivityEntry[];
}

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

const TYPE_ROUTE: Record<string, string> = {
  congress: "congress",
  hedge_fund: "hedge-fund",
  investor: "investor",
  insider: "insider",
};

function StatPill({ label, count }: { label: string; count: number }) {
  return (
    <div className="flex flex-col items-center gap-0.5 rounded-md bg-foreground/5 px-3 py-2">
      <span className={`text-lg font-bold ${count > 0 ? "text-foreground" : "text-foreground/30"}`}>{count}</span>
      <span className="text-center text-[11px] text-foreground/50">{label}</span>
    </div>
  );
}

export default function NotableHoldersCard({ ticker }: { ticker: string }) {
  const [data, setData] = useState<NotableHoldersData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!cancelled) {
        setData(null);
        setError(null);
      }
      try {
        const response = await fetch(`/api/trackers/by-ticker/${encodeURIComponent(ticker)}`);
        if (!response.ok) throw new Error("request failed");
        const body = await response.json();
        if (!cancelled) setData(body);
      } catch {
        if (!cancelled) setError("Data unavailable");
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [ticker]);

  const hasAnyActivity = data && (data.holders.length > 0 || data.recentActivity.length > 0);

  return (
    <div className={cardClass("neutral", { extra: "flex flex-col gap-3 p-4" })}>
      <h3 className="font-semibold text-foreground">Notable Holders</h3>
      <p className="text-xs text-foreground/40">
        Tracked members of Congress, hedge funds, and company insiders known to hold or have recently traded this stock.
      </p>

      {!data && !error && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-14 w-full animate-pulse rounded-md bg-foreground/10" />
          ))}
        </div>
      )}

      {error && <p className="text-sm text-foreground/60">Data unavailable</p>}

      {data && (
        <>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <StatPill label="Members of Congress" count={data.congressHolderCount} />
            <StatPill label="Hedge Funds" count={data.hedgeFundHolderCount} />
            <StatPill label="Recent Insider Txns" count={data.recentInsiderTransactionCount} />
          </div>

          {!hasAnyActivity && (
            <p className="text-sm text-foreground/60">No tracked ownership activity found for this stock yet.</p>
          )}

          {hasAnyActivity && (
            <>
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="flex items-center gap-1 self-start text-sm text-indigo-400 hover:underline"
              >
                {expanded ? "Hide" : "View"} ownership activity
                <ChevronDown size={14} className={`transition-transform ${expanded ? "rotate-180" : ""}`} />
              </button>

              {expanded && (
                <div className="flex flex-col gap-4">
                  {data.holders.length > 0 && (
                    <div className="flex flex-col gap-1.5">
                      <span className="text-xs font-medium text-foreground/50">Current Holders</span>
                      {data.holders.map((h) => (
                        <Link
                          key={h.slug}
                          href={`/trackers/${TYPE_ROUTE[h.type] ?? h.type}/${h.slug}`}
                          className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-xs transition-colors hover:bg-foreground/5"
                        >
                          <span className="text-foreground">{h.name}</span>
                          <span className="text-foreground/50">
                            {h.estimatedValue != null ? currencyFormatter.format(h.estimatedValue) : "—"}
                            {h.isEstimate && <span className="ml-1 text-amber-500">(est.)</span>}
                          </span>
                        </Link>
                      ))}
                    </div>
                  )}

                  {data.recentActivity.length > 0 && (
                    <div className="flex flex-col gap-1.5">
                      <span className="text-xs font-medium text-foreground/50">Recent Activity</span>
                      {data.recentActivity.map((a, i) => (
                        <div key={i} className="flex items-center justify-between gap-2 px-2 py-1 text-xs">
                          <div className="flex flex-col">
                            <Link href={`/trackers/${TYPE_ROUTE[a.entityType] ?? a.entityType}/${a.entitySlug}`} className="text-foreground hover:underline">
                              {a.reportingPersonName ?? a.entityName}
                            </Link>
                            <span className="text-foreground/40">{a.reportedDate ? new Date(a.reportedDate).toLocaleDateString() : "—"}</span>
                          </div>
                          <span
                            className={`font-medium ${
                              a.transactionType === "buy" ? "text-green-500" : a.transactionType === "sell" ? "text-red-500" : "text-foreground/60"
                            }`}
                          >
                            {a.transactionType.replace("_", " ")}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
