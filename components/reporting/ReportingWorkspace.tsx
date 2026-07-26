"use client";

import { useState } from "react";
import Link from "next/link";
import ReportGeneratorForm from "@/components/reporting/ReportGeneratorForm";
import ReportHistoryList from "@/components/reporting/ReportHistoryList";

type TabKey = "generate" | "history";

// Generate/History tab shell — same idiom as
// components/compliance/ComplianceDashboard.tsx's TabBar.
export default function ReportingWorkspace({ isAdmin }: { isAdmin: boolean }) {
  const [activeTab, setActiveTab] = useState<TabKey>("generate");
  const [refreshToken, setRefreshToken] = useState(0);

  return (
    <div className="flex w-full max-w-3xl flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/10 pb-2 dark:border-white/15">
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setActiveTab("generate")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-150 ease-out ${
              activeTab === "generate"
                ? "bg-indigo-500 text-white"
                : "text-foreground/60 hover:bg-foreground/5 hover:text-foreground"
            }`}
          >
            Generate
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("history")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-150 ease-out ${
              activeTab === "history"
                ? "bg-indigo-500 text-white"
                : "text-foreground/60 hover:bg-foreground/5 hover:text-foreground"
            }`}
          >
            History
          </button>
        </div>
        {/* Model Portfolios and Peer Benchmarking are each their own page
            (own data model/routes) — linked here rather than given their
            own Sidebar.tsx entries, matching ComplianceDashboard.tsx's own
            "Manage team & organization →" link-next-to-tabs pattern. */}
        <div className="flex gap-3">
          <Link href="/portfolios/models" className="text-xs text-indigo-400 hover:underline">
            Model Portfolios →
          </Link>
          <Link href="/benchmarking" className="text-xs text-indigo-400 hover:underline">
            Peer Benchmarking →
          </Link>
        </div>
      </div>

      {activeTab === "generate" && (
        <ReportGeneratorForm
          onCreated={() => {
            setRefreshToken((t) => t + 1);
            setActiveTab("history");
          }}
        />
      )}
      {activeTab === "history" && <ReportHistoryList refreshToken={refreshToken} isAdmin={isAdmin} />}
    </div>
  );
}
