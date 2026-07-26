"use client";

import { useEffect, useState } from "react";
import { cardClass } from "@/lib/cardStyles";

interface ReportSummary {
  id: string;
  clientName: string;
  calculators: Array<{ type: string }>;
  portfolioSource: string;
  createdAt: string;
  createdByUserId: string;
  creatorName: string | null;
}

interface ReportHistoryListProps {
  refreshToken: number;
  isAdmin: boolean;
}

// View/Download are plain <a href> links (no client fetch/blob handling) —
// GET /api/reporting/reports/[id]/pdf's Content-Disposition header alone
// drives inline-vs-attachment, matching components/compliance/ExportButtons.tsx's
// established precedent.
export default function ReportHistoryList({ refreshToken, isAdmin }: ReportHistoryListProps) {
  const [reports, setReports] = useState<ReportSummary[] | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const res = await fetch("/api/reporting/reports");
      const body = await res.json().catch(() => null);
      if (!cancelled && res.ok) setReports(body?.reports ?? []);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [refreshToken]);

  if (!reports) return <p className="text-sm text-foreground/50">Loading reports…</p>;
  if (reports.length === 0) return <p className="text-sm text-foreground/50">No reports yet.</p>;

  return (
    <div className="flex flex-col gap-2">
      {reports.map((r) => (
        <div key={r.id} className={cardClass("neutral", { extra: "flex items-center justify-between gap-2 p-3" })}>
          <div>
            <p className="text-sm font-medium text-foreground">{r.clientName}</p>
            <p className="text-xs text-foreground/50">
              {r.calculators.map((c) => c.type).join(", ")} · {new Date(r.createdAt).toLocaleDateString()}
              {isAdmin && r.creatorName ? ` · ${r.creatorName}` : ""}
            </p>
          </div>
          <div className="flex gap-2">
            <a
              href={`/api/reporting/reports/${r.id}/pdf`}
              target="_blank"
              rel="noreferrer"
              className="rounded-md border border-black/10 px-2 py-1 text-xs font-medium text-foreground/70 hover:text-foreground dark:border-white/15"
            >
              View
            </a>
            <a
              href={`/api/reporting/reports/${r.id}/pdf?download=1`}
              className="rounded-md border border-black/10 px-2 py-1 text-xs font-medium text-foreground/70 hover:text-foreground dark:border-white/15"
            >
              Download
            </a>
          </div>
        </div>
      ))}
    </div>
  );
}
