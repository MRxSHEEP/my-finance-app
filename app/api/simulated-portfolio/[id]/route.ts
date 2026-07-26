import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth-helpers";
import { getSimulatedPortfolioDetail } from "@/lib/simulatedTrading/portfolioDetail";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUserId();
  if (auth.error) return auth.error;

  const { id } = await params;

  const portfolio = await prisma.simulatedPortfolio.findUnique({ where: { id }, select: { userId: true } });
  if (!portfolio || portfolio.userId !== auth.userId) {
    return NextResponse.json({ error: "Simulated portfolio not found" }, { status: 404 });
  }

  const detail = await getSimulatedPortfolioDetail(id);
  if (!detail) return NextResponse.json({ error: "Simulated portfolio not found" }, { status: 404 });

  return NextResponse.json(detail);
}
