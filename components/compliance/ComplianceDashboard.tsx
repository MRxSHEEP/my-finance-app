"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { cardClass } from "@/lib/cardStyles";
import PreclearanceTable from "@/components/compliance/PreclearanceTable";
import FlaggedTradesTab from "@/components/compliance/FlaggedTradesTab";
import RestrictedListTab from "@/components/compliance/RestrictedListTab";
import AuditLogTab from "@/components/compliance/AuditLogTab";
import ExportButtons from "@/components/compliance/ExportButtons";

type TabKey = "pending" | "flags" | "restricted" | "audit";

const TAB_DEFS: Array<{ key: TabKey; label: string }> = [
  { key: "pending", label: "Pending Requests" },
  { key: "flags", label: "Flagged Trades" },
  { key: "restricted", label: "Restricted List" },
  { key: "audit", label: "Audit Log" },
];

// Mirrors components/trackers/TrackerDetailView.tsx's tab-button styling —
// no shared TabBar component exists to import instead.
function TabBar({ active, onSelect }: { active: TabKey; onSelect: (tab: TabKey) => void }) {
  return (
    <div className="flex w-full flex-wrap items-center justify-between gap-2 border-b border-black/10 pb-2 dark:border-white/15">
      <div className="flex flex-wrap gap-1">
        {TAB_DEFS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => onSelect(tab.key)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-150 ease-out ${
              active === tab.key ? "bg-indigo-500 text-white" : "text-foreground/60 hover:bg-foreground/5 hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {/* Team/seat management moved to the shared org settings page — this
          is the only entry point from Compliance now (see the Team/Seat
          Infrastructure plan's "exactly one seat-management surface"). */}
      <Link href="/settings/organization" className="text-xs text-indigo-400 hover:underline">
        Manage team &amp; organization →
      </Link>
    </div>
  );
}

interface PendingRequest {
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

function PendingRequestsTab() {
  const [requests, setRequests] = useState<PendingRequest[] | null>(null);
  // Bumped after a decision is recorded, to re-run the effect below —
  // mirrors SimulatedPortfolioDetailView.tsx's refreshToken idiom.
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const res = await fetch("/api/compliance/preclearance?status=pending");
      const body = await res.json().catch(() => null);
      if (!cancelled && res.ok) setRequests(body?.requests ?? []);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [refreshToken]);

  async function handleDecide(id: string, decision: "approved" | "denied") {
    await fetch(`/api/compliance/preclearance/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision }),
    });
    setRefreshToken((t) => t + 1);
  }

  return (
    <div className={cardClass("neutral", { extra: "flex flex-col gap-3 p-4" })}>
      <h2 className="text-lg font-semibold text-foreground">Pending pre-clearance requests</h2>
      <PreclearanceTable requests={requests ?? []} showEmployeeColumn onDecide={handleDecide} />
    </div>
  );
}

export default function ComplianceDashboard() {
  const [activeTab, setActiveTab] = useState<TabKey>("pending");

  return (
    <div className="flex w-full max-w-5xl flex-col gap-6">
      <TabBar active={activeTab} onSelect={setActiveTab} />

      {activeTab === "pending" && <PendingRequestsTab />}
      {activeTab === "flags" && <FlaggedTradesTab />}
      {activeTab === "restricted" && <RestrictedListTab canManage />}
      {activeTab === "audit" && <AuditLogTab />}

      <ExportButtons />
    </div>
  );
}
