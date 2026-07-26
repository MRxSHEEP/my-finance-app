import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth-helpers";
import { isSectionKey } from "@/lib/digest/sections";
import { CATALOG_SECTORS } from "@/lib/stockCatalog";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireUserId();
  if (auth.error) return auth.error;

  const config = await prisma.dashboardConfig.findUnique({ where: { userId: auth.userId } });

  return NextResponse.json({
    sectionOrder: (config?.sectionOrder as string[] | undefined) ?? null,
    sectorCardsSectors: (config?.sectorCardsSectors as string[] | null | undefined) ?? null,
  });
}

export async function PUT(request: NextRequest) {
  const auth = await requireUserId();
  if (auth.error) return auth.error;

  const body = await request.json().catch(() => null);
  const sectionOrder = body?.sectionOrder;

  if (!Array.isArray(sectionOrder) || sectionOrder.length === 0 || !sectionOrder.every(isSectionKey)) {
    return NextResponse.json(
      { error: "sectionOrder must be a non-empty array of known section keys" },
      { status: 400 }
    );
  }
  if (new Set(sectionOrder).size !== sectionOrder.length) {
    return NextResponse.json({ error: "sectionOrder cannot contain duplicates" }, { status: 400 });
  }

  let sectorCardsSectors: string[] | null = null;
  if (body?.sectorCardsSectors !== undefined && body?.sectorCardsSectors !== null) {
    const raw = body.sectorCardsSectors;
    if (!Array.isArray(raw) || raw.length === 0 || !raw.every((s: unknown) => (CATALOG_SECTORS as readonly string[]).includes(s as string))) {
      return NextResponse.json(
        { error: "sectorCardsSectors must be a non-empty array of known sector names" },
        { status: 400 }
      );
    }
    sectorCardsSectors = raw;
  }

  const config = await prisma.dashboardConfig.upsert({
    where: { userId: auth.userId },
    create: { userId: auth.userId, sectionOrder, sectorCardsSectors: sectorCardsSectors ?? Prisma.JsonNull },
    update: { sectionOrder, sectorCardsSectors: sectorCardsSectors ?? Prisma.JsonNull },
  });

  return NextResponse.json({
    sectionOrder: config.sectionOrder as string[],
    sectorCardsSectors: (config.sectorCardsSectors as string[] | null) ?? null,
  });
}

export async function DELETE() {
  const auth = await requireUserId();
  if (auth.error) return auth.error;

  await prisma.dashboardConfig.deleteMany({ where: { userId: auth.userId } });
  return NextResponse.json({ ok: true });
}
