import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth-helpers";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireUserId();
  if (auth.error) return auth.error;

  const { id } = await params;
  const body = await request.json().catch(() => null);

  const data: { shares?: number; costBasis?: number; purchaseDate?: Date } = {};

  if (body?.shares !== undefined) {
    const shares = Number(body.shares);
    if (!Number.isFinite(shares) || shares <= 0) {
      return NextResponse.json({ error: "Shares must be a positive number" }, { status: 400 });
    }
    data.shares = shares;
  }
  if (body?.costBasis !== undefined) {
    const costBasis = Number(body.costBasis);
    if (!Number.isFinite(costBasis) || costBasis < 0) {
      return NextResponse.json(
        { error: "Cost basis must be a non-negative number" },
        { status: 400 }
      );
    }
    data.costBasis = costBasis;
  }
  if (body?.purchaseDate !== undefined) {
    const purchaseDate = new Date(body.purchaseDate);
    if (Number.isNaN(purchaseDate.getTime())) {
      return NextResponse.json({ error: "Invalid purchase date" }, { status: 400 });
    }
    data.purchaseDate = purchaseDate;
  }

  // updateMany (not update): scopes the write to rows this user actually
  // owns, so a mismatched/foreign id resolves to "0 rows updated" rather
  // than either leaking a not-found-vs-forbidden distinction or Prisma's
  // own "record not found" throw.
  const result = await prisma.portfolioHolding.updateMany({
    where: { id, userId: auth.userId },
    data,
  });

  if (result.count === 0) {
    return NextResponse.json({ error: "Holding not found" }, { status: 404 });
  }

  const holding = await prisma.portfolioHolding.findUnique({ where: { id } });
  return NextResponse.json({ holding });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireUserId();
  if (auth.error) return auth.error;

  const { id } = await params;

  await prisma.portfolioHolding.deleteMany({
    where: { id, userId: auth.userId },
  });

  return NextResponse.json({ ok: true });
}
