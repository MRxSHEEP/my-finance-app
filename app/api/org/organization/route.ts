import { NextRequest, NextResponse } from "next/server";
import { requireOrgAdmin } from "@/lib/orgAuth";
import { prisma } from "@/lib/prisma";
import { logOrgAction } from "@/lib/org/auditLog";

export const dynamic = "force-dynamic";

const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

export async function GET() {
  const ctx = await requireOrgAdmin();
  if (ctx.error) return ctx.error;

  const organization = await prisma.organization.findUnique({ where: { id: ctx.organizationId } });
  if (!organization) return NextResponse.json({ error: "Organization not found" }, { status: 404 });

  return NextResponse.json({
    organization: {
      id: organization.id,
      name: organization.name,
      logoUrl: organization.logoUrl,
      brandColor: organization.brandColor,
      billingActive: Boolean(organization.stripeSubscriptionId),
    },
  });
}

export async function PATCH(request: NextRequest) {
  const ctx = await requireOrgAdmin();
  if (ctx.error) return ctx.error;

  const body = await request.json().catch(() => null);
  const data: { name?: string; brandColor?: string | null } = {};

  if (typeof body?.name === "string") {
    const name = body.name.trim();
    if (!name) return NextResponse.json({ error: "Organization name cannot be empty" }, { status: 400 });
    data.name = name;
  }
  if (body?.brandColor !== undefined) {
    if (body.brandColor === null) {
      data.brandColor = null;
    } else if (typeof body.brandColor === "string" && HEX_COLOR_PATTERN.test(body.brandColor)) {
      data.brandColor = body.brandColor;
    } else {
      return NextResponse.json({ error: "brandColor must be a hex color like #6366f1" }, { status: 400 });
    }
  }

  const organization = await prisma.organization.update({ where: { id: ctx.organizationId }, data });
  await logOrgAction({
    organizationId: ctx.organizationId,
    actorUserId: ctx.userId,
    action: "branding_updated",
    targetType: "Organization",
    targetId: ctx.organizationId,
    details: data,
  });

  return NextResponse.json({
    organization: {
      id: organization.id,
      name: organization.name,
      logoUrl: organization.logoUrl,
      brandColor: organization.brandColor,
      billingActive: Boolean(organization.stripeSubscriptionId),
    },
  });
}
