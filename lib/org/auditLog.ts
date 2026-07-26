import { logAction } from "@/lib/auditLog";

// General org/seat-management actions performed from /settings/organization
// — distinct from Compliance's own actions (lib/compliance/auditLog.ts),
// since these are performed from a page that's deliberately not part of
// Compliance. Tagged featureArea:"org" rather than "compliance".
export type OrgAuditAction =
  | "invite_created"
  | "invite_revoked"
  | "member_joined"
  | "member_role_changed"
  | "member_removed"
  | "branding_updated"
  | "billing_subscription_started";

interface LogOrgActionParams {
  organizationId: string;
  actorUserId: string;
  action: OrgAuditAction;
  targetType?: string;
  targetId?: string;
  details?: object;
}

export async function logOrgAction(params: LogOrgActionParams): Promise<void> {
  await logAction({ featureArea: "org", ...params });
}
