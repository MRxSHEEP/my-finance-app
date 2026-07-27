// Fictional data for the Compliance Preview walkthrough
// (components/compliance/preview/ComplianceWalkthrough.tsx). Nothing here
// is fetched — every scene renders straight from these constants — and
// every name/ticker/org is deliberately invented so it can't be mistaken
// for a real account, employee, or company.

export const DEMO_ORG_NAME = "Acme Capital Management";

export const DEMO_RESTRICTED_ENTRIES = [
  { id: "demo-r1", ticker: "ZNTH", companyName: "Zenith Robotics, Inc." },
  { id: "demo-r2", ticker: "ORBT", companyName: "Orbit Semiconductor Ltd." },
  { id: "demo-r3", ticker: "KVLR", companyName: "Kevlar Biotech Corp." },
];

export const DEMO_DISCLOSURE = {
  employeeName: "Jamie Osei",
  ticker: "GLBX",
  tradeDate: "2026-07-27",
  transactionType: "buy" as const,
  quantity: "250",
  notes: "Routine portfolio rebalance",
};

export const DEMO_FLAG = {
  ticker: "GLBX",
  employeeName: "Jamie Osei",
  tradeDateLabel: "Jul 27, 2026",
  flaggedDateLabel: "Jul 27, 2026",
  insiderName: "Casey Whitfield",
  insiderRole: "CFO",
  insiderTransactionType: "sell",
  insiderTradeDateLabel: "Jul 24, 2026",
};

export const DEMO_PRECLEARANCE_REQUEST = {
  id: "demo-p1",
  ticker: "NRDA",
  proposedTradeDate: "2026-07-29",
  transactionType: "buy" as const,
  quantity: 100,
  notes: null,
  createdAt: "2026-07-27T00:00:00.000Z",
  user: { name: "Priya Chandra", email: "priya@acmecapital.example" },
};

export const DEMO_AUDIT_ENTRIES = [
  { id: "demo-a4", whenLabel: "Jul 24, 2026, 9:15 AM", actor: "Morgan Ellis", action: "restricted list add", ticker: "ZNTH" },
  { id: "demo-a3", whenLabel: "Jul 24, 2026, 9:16 AM", actor: "Morgan Ellis", action: "restricted list add", ticker: "ORBT" },
  { id: "demo-a2", whenLabel: "Jul 27, 2026, 10:02 AM", actor: "Jamie Osei", action: "trade disclosed", ticker: "GLBX" },
  { id: "demo-a1", whenLabel: "Jul 27, 2026, 10:02 AM", actor: "System", action: "flag created", ticker: "GLBX" },
];

export const DEMO_NEW_AUDIT_ENTRY = {
  id: "demo-a0",
  whenLabel: "Jul 27, 2026, 10:04 AM",
  actor: "Morgan Ellis",
  action: "preclearance approved",
  ticker: "NRDA",
};
