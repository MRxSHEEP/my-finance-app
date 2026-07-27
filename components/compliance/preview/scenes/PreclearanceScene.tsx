"use client";

import { useEffect, useState } from "react";
import { ClipboardCheck } from "lucide-react";
import { cardClass } from "@/lib/cardStyles";
import PreclearanceTable from "@/components/compliance/PreclearanceTable";
import { DEMO_PRECLEARANCE_REQUEST } from "@/components/compliance/preview/sampleData";

const APPROVE_AFTER_MS = 2200;

// Reuses the real PreclearanceTable component (it's pure/presentational —
// no internal fetch) so this scene is the actual production UI, not a
// lookalike. The pending -> approved transition is local state only: it
// plays automatically, but `onDecide` also lets a visitor click Approve/Deny
// themselves without ever calling the real API route.
export default function PreclearanceScene() {
  // Fresh mount each time this scene becomes active (the parent keys its
  // wrapper on scene index), so the "pending" initial value here already
  // covers the reset — no need to also set it inside the effect below.
  const [status, setStatus] = useState<"pending" | "approved" | "denied">("pending");

  useEffect(() => {
    const timer = setTimeout(() => setStatus("approved"), APPROVE_AFTER_MS);
    return () => clearTimeout(timer);
  }, []);

  async function handleDecide(_id: string, decision: "approved" | "denied") {
    setStatus(decision);
  }

  const request = {
    ...DEMO_PRECLEARANCE_REQUEST,
    status,
    decisionNotes: status === "approved" ? "Approved — no restricted list conflict" : status === "denied" ? "Denied" : null,
  };

  return (
    <div className={cardClass("neutral", { extra: "flex flex-col gap-3 p-4" })}>
      <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
        <ClipboardCheck size={15} className="text-foreground/40" />
        Pending pre-clearance requests
      </h3>
      <PreclearanceTable requests={[request]} showEmployeeColumn onDecide={handleDecide} />
    </div>
  );
}
