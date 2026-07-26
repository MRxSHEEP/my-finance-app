import { NextRequest, NextResponse } from "next/server";
import { requireOrgRole } from "@/lib/complianceAuth";
import { queryAuditLog } from "@/lib/auditLog";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const ctx = await requireOrgRole("compliance_officer");
  if (ctx.error) return ctx.error;

  const params = request.nextUrl.searchParams;
  const action = params.get("action") || undefined;
  const ticker = params.get("ticker")?.trim().toUpperCase() || undefined;
  const fromParam = params.get("from");
  const toParam = params.get("to");
  const page = Math.max(1, Number.parseInt(params.get("page") ?? "1", 10) || 1);

  const result = await queryAuditLog({
    organizationId: ctx.organizationId,
    featureArea: "compliance",
    action,
    ticker,
    from: fromParam ? new Date(fromParam) : undefined,
    to: toParam ? new Date(toParam) : undefined,
    page,
  });

  return NextResponse.json(result);
}
