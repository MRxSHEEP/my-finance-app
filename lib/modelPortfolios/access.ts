import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrgMembership, type OrgMembershipContext } from "@/lib/orgAuth";

export type PortfolioAccessResult = { ctx: OrgMembershipContext; error?: undefined } | { ctx?: undefined; error: NextResponse };

// Shared "does this membership have Reporting access at all, and is it
// either the portfolio's own creator or an org-wide Admin" check — used by
// every /api/model-portfolios/[id]* route. A plain advisor gets 404 (not
// 403) on another advisor's portfolio, matching TradeDisclosure's own
// employee-private-by-default/Admin-sees-all pattern, so its existence
// isn't confirmed either way.
export async function requirePortfolioAccess(id: string): Promise<PortfolioAccessResult> {
  const ctx = await requireOrgMembership();
  if (ctx.error) return { error: ctx.error };

  const isAdmin = ctx.orgRole === "admin";
  if (!isAdmin && ctx.featureGrants["reporting"] === undefined) {
    return { error: NextResponse.json({ error: "Not part of Reporting" }, { status: 403 }) };
  }

  const modelPortfolio = await prisma.modelPortfolio.findUnique({
    where: { id },
    select: { organizationId: true, createdByUserId: true },
  });
  const hasAccess =
    modelPortfolio != null &&
    modelPortfolio.organizationId === ctx.organizationId &&
    (isAdmin || modelPortfolio.createdByUserId === ctx.userId);

  if (!hasAccess) {
    return { error: NextResponse.json({ error: "Model portfolio not found" }, { status: 404 }) };
  }
  return { ctx };
}
