import { NextRequest, NextResponse } from "next/server";
import { requireOrgRole } from "@/lib/complianceAuth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const VALID_STATUSES = ["open", "reviewed"];

export async function GET(request: NextRequest) {
  const ctx = await requireOrgRole("compliance_officer");
  if (ctx.error) return ctx.error;

  const statusParam = request.nextUrl.searchParams.get("status") ?? "open";
  const status = VALID_STATUSES.includes(statusParam) ? statusParam : "open";

  const flags = await prisma.complianceFlag.findMany({
    where: { organizationId: ctx.organizationId, status },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ flags });
}
