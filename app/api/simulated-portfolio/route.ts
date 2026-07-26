import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth-helpers";

export const dynamic = "force-dynamic";

// Lightweight listing for the tab on /portfolio — full per-portfolio
// value/return/holdings computation (which needs live prices) lives in
// GET /api/simulated-portfolio/[id] instead, fetched only once a user
// actually opens one.
export async function GET() {
  const auth = await requireUserId();
  if (auth.error) return auth.error;

  const portfolios = await prisma.simulatedPortfolio.findMany({
    where: { userId: auth.userId },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { holdings: true, transactions: true } } },
  });

  return NextResponse.json({
    portfolios: portfolios.map((p) => ({
      id: p.id,
      tier: p.tier,
      startingBalance: p.startingBalance,
      cashBalance: p.cashBalance,
      holdingsCount: p._count.holdings,
      transactionsCount: p._count.transactions,
      createdAt: p.createdAt.toISOString(),
    })),
  });
}
