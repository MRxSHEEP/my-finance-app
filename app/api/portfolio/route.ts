import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth-helpers";

// See app/api/watchlist/route.ts for why this is required even though
// nothing here looks request-dependent to Next's static analysis.
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireUserId();
  if (auth.error) return auth.error;

  const holdings = await prisma.portfolioHolding.findMany({
    where: { userId: auth.userId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ holdings });
}

export async function POST(request: NextRequest) {
  const auth = await requireUserId();
  if (auth.error) return auth.error;

  const body = await request.json().catch(() => null);
  const symbol = typeof body?.symbol === "string" ? body.symbol.trim().toUpperCase() : "";
  const shares = Number(body?.shares);
  const costBasis = Number(body?.costBasis);
  const purchaseDate = typeof body?.purchaseDate === "string" ? new Date(body.purchaseDate) : null;

  if (!symbol) {
    return NextResponse.json({ error: "Missing required field: symbol" }, { status: 400 });
  }
  if (!Number.isFinite(shares) || shares <= 0) {
    return NextResponse.json({ error: "Shares must be a positive number" }, { status: 400 });
  }
  if (!Number.isFinite(costBasis) || costBasis < 0) {
    return NextResponse.json({ error: "Cost basis must be a non-negative number" }, { status: 400 });
  }
  if (!purchaseDate || Number.isNaN(purchaseDate.getTime())) {
    return NextResponse.json({ error: "Invalid purchase date" }, { status: 400 });
  }

  const holding = await prisma.portfolioHolding.create({
    data: { userId: auth.userId, symbol, shares, costBasis, purchaseDate },
  });

  return NextResponse.json({ holding }, { status: 201 });
}
