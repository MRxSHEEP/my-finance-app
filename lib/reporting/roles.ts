// Isomorphic (no server-only imports), mirrors lib/compliance/roles.ts's
// shape. Reporting has exactly one role today — this still goes through
// the same hasAtLeast/ROLE_RANK plumbing as Compliance so a future second
// tier (e.g. "senior_advisor") is a one-line addition, not a rewrite.
export type ReportingRole = "advisor";

const ROLE_RANK: Record<ReportingRole, number> = {
  advisor: 0,
};

export function hasAtLeastRole(role: ReportingRole, min: ReportingRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[min];
}
