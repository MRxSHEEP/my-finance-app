import { logAction } from "@/lib/auditLog";

export type ComplianceAuditAction =
  | "restricted_list_add"
  | "restricted_list_remove"
  | "trade_disclosed"
  | "preclearance_requested"
  | "preclearance_approved"
  | "preclearance_denied"
  | "flag_created"
  | "flag_reviewed"
  | "invite_created"
  | "member_joined"
  | "member_role_changed"
  | "member_removed";

interface LogComplianceActionParams {
  organizationId: string;
  actorUserId: string;
  action: ComplianceAuditAction;
  targetType?: string;
  targetId?: string;
  ticker?: string;
  details?: object;
}

// Thin wrapper over the generic lib/auditLog.ts service — every mutating
// Compliance route keeps calling this with its exact existing arguments;
// only the internal implementation now writes through the shared table.
export async function logComplianceAction(params: LogComplianceActionParams): Promise<void> {
  await logAction({ featureArea: "compliance", ...params });
}
