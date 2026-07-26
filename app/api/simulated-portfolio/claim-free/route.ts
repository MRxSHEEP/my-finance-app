import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth-helpers";
import { getTier } from "@/lib/simulatedTrading/tiers";

export const dynamic = "force-dynamic";

const FREE_TIER_ID = "starter";

// No Stripe involvement at all — the free tier is granted instantly. Unlike
// the paid tiers (see .../checkout/route.ts + app/api/webhooks/stripe),
// there's no payment to confirm first.
export async function POST() {
  const auth = await requireUserId();
  if (auth.error) return auth.error;

  const tier = getTier(FREE_TIER_ID);
  if (!tier) {
    return NextResponse.json({ error: "Free tier is not configured" }, { status: 500 });
  }

  const portfolio = await prisma.simulatedPortfolio.create({
    data: {
      userId: auth.userId,
      tier: tier.id,
      startingBalance: tier.startingBalance,
      cashBalance: tier.startingBalance,
      priceCents: 0,
    },
  });

  return NextResponse.json({ portfolio }, { status: 201 });
}
