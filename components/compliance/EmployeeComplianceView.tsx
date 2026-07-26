"use client";

import { useEffect, useState } from "react";
import { cardClass } from "@/lib/cardStyles";
import TradeReportForm from "@/components/compliance/TradeReportForm";
import DisclosuresTable from "@/components/compliance/DisclosuresTable";
import PreclearanceTable from "@/components/compliance/PreclearanceTable";
import RestrictedListTab from "@/components/compliance/RestrictedListTab";

interface DisclosureRow {
  id: string;
  ticker: string;
  tradeDate: string;
  transactionType: string;
  quantity: number;
  notes: string | null;
  createdAt: string;
}

interface PreclearanceRow {
  id: string;
  ticker: string;
  proposedTradeDate: string;
  transactionType: string;
  quantity: number;
  status: string;
  notes: string | null;
  decisionNotes: string | null;
  createdAt: string;
}

export default function EmployeeComplianceView() {
  const [disclosures, setDisclosures] = useState<DisclosureRow[]>([]);
  const [requests, setRequests] = useState<PreclearanceRow[]>([]);
  // Bumped after a form submission, to re-run the effect below — mirrors
  // SimulatedPortfolioDetailView.tsx's refreshToken idiom rather than
  // exposing a directly-callable reload function.
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const [disclosuresRes, requestsRes] = await Promise.all([
        fetch("/api/compliance/disclosures"),
        fetch("/api/compliance/preclearance"),
      ]);
      const disclosuresBody = await disclosuresRes.json().catch(() => null);
      const requestsBody = await requestsRes.json().catch(() => null);
      if (cancelled) return;
      if (disclosuresRes.ok) setDisclosures(disclosuresBody?.disclosures ?? []);
      if (requestsRes.ok) setRequests(requestsBody?.requests ?? []);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [refreshToken]);

  function handleSubmitted() {
    setRefreshToken((t) => t + 1);
  }

  return (
    <div className="flex w-full max-w-4xl flex-col gap-6">
      <RestrictedListTab canManage={false} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <TradeReportForm mode="disclosure" onSubmitted={handleSubmitted} />
        <TradeReportForm mode="preclearance" onSubmitted={handleSubmitted} />
      </div>

      <div className={cardClass("neutral", { extra: "flex flex-col gap-3 p-4" })}>
        <h2 className="text-lg font-semibold text-foreground">My disclosures</h2>
        <DisclosuresTable disclosures={disclosures} />
      </div>

      <div className={cardClass("neutral", { extra: "flex flex-col gap-3 p-4" })}>
        <h2 className="text-lg font-semibold text-foreground">My pre-clearance requests</h2>
        <PreclearanceTable requests={requests} />
      </div>
    </div>
  );
}
