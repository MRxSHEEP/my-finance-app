import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePortfolioAccess } from "@/lib/modelPortfolios/access";
import { generateShareToken } from "@/lib/modelPortfolios/shareToken";

export const dynamic = "force-dynamic";

// Generate-or-REGENERATE. Regenerating always replaces `token` outright —
// the old value stops existing in the table at all (not just hidden/
// unlisted), so any lookup by it immediately returns zero rows. This is a
// one-way action: the old link cannot be recovered, only reissued as a new
// one.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requirePortfolioAccess(id);
  if (access.error) return access.error;

  const token = generateShareToken();
  const shareLink = await prisma.modelPortfolioShareLink.upsert({
    where: { modelPortfolioId: id },
    create: { modelPortfolioId: id, token, active: true },
    update: { token, active: true },
  });

  return NextResponse.json({ shareLink: { token: shareLink.token, active: shareLink.active } });
}

// The reversible pause/resume toggle — same token preserved either way.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requirePortfolioAccess(id);
  if (access.error) return access.error;

  const body = await request.json().catch(() => null);
  if (typeof body?.active !== "boolean") {
    return NextResponse.json({ error: "active (boolean) is required" }, { status: 400 });
  }

  const existing = await prisma.modelPortfolioShareLink.findUnique({ where: { modelPortfolioId: id } });
  if (!existing) return NextResponse.json({ error: "No share link exists yet" }, { status: 404 });

  const shareLink = await prisma.modelPortfolioShareLink.update({
    where: { modelPortfolioId: id },
    data: { active: body.active },
  });

  return NextResponse.json({ shareLink: { token: shareLink.token, active: shareLink.active } });
}
