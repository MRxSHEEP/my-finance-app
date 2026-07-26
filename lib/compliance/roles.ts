// Isomorphic (no server-only imports) — used both by API routes deciding
// what to allow and by client components deciding what to render.
export type ComplianceRole = "employee" | "compliance_officer" | "admin";

const ROLE_RANK: Record<ComplianceRole, number> = {
  employee: 0,
  compliance_officer: 1,
  admin: 2,
};

export function hasAtLeastRole(role: ComplianceRole, min: ComplianceRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[min];
}
