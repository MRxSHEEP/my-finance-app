// Shared shapes for the Compliance Copilot feature — an assistive,
// non-persisting AI draft layer over the existing Preclearance workflow
// (see app/api/compliance/preclearance/[id]/ai-review/route.ts and
// components/compliance/PreclearanceTable.tsx). Nothing here is ever
// written to the database; it's gathered fresh per request and discarded
// once the response is sent.

export interface RestrictedListContext {
  ticker: string;
  companyName: string | null;
  notes: string | null;
  addedAt: string;
}

// Passed through from ComplianceFlag.details as-is — shape varies by
// flagType ("restricted_list" | "insider_proximity", see
// lib/compliance/flagging.ts), which is exactly why this stays untyped
// here rather than modeled field-by-field.
export interface ExistingFlagContext {
  flagType: string;
  details: unknown;
}

export interface PriorActivityEntry {
  source: "trade_disclosure" | "preclearance_request";
  transactionType: string;
  quantity: number;
  date: string;
  // Only meaningful for a prior preclearance_request entry.
  status?: string;
}

export interface PreclearanceReviewContext {
  request: {
    ticker: string;
    transactionType: string;
    quantity: number;
    proposedTradeDate: string;
    notes: string | null;
    employeeName: string;
  };
  restrictedListEntry: RestrictedListContext | null;
  // Already-created ComplianceFlag rows for this exact request (the
  // automatic rule-based check in lib/compliance/flagging.ts already ran
  // at submission time) — this feature synthesizes them into plain
  // language, it never re-derives or duplicates that check.
  existingFlags: ExistingFlagContext[];
  priorActivitySameTicker: PriorActivityEntry[];
}

export interface ComplianceReview {
  flag: boolean;
  rationale: string;
  suggestedNote: string;
}
