import { NextResponse } from "next/server";
import { requireOrgAdmin } from "@/lib/orgAuth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await requireOrgAdmin();
  if (ctx.error) return ctx.error;

  const memberships = await prisma.membership.findMany({
    where: { organizationId: ctx.organizationId },
    include: {
      user: { select: { id: true, name: true, email: true } },
      featureRoleGrants: { select: { featureArea: true, role: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({
    members: memberships.map((m) => ({
      id: m.id,
      orgRole: m.orgRole,
      createdAt: m.createdAt,
      userId: m.user.id,
      name: m.user.name,
      email: m.user.email,
      grants: m.featureRoleGrants,
    })),
  });
}
