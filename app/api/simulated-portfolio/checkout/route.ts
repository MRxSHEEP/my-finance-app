import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { requireUserId } from "@/lib/auth-helpers";
import { getTier } from "@/lib/simulatedTrading/tiers";

export const dynamic = "force-dynamic";

// Creates a Stripe Checkout Session (hosted, redirect-based — no card form
// of our own, no client-side Stripe.js needed at all) for one of the paid
// tiers. This route only ever hands back a session URL; it never grants
// any balance itself — see app/api/webhooks/stripe/route.ts, the only
// place a SimulatedPortfolio row for a paid tier is ever created, and only
// once Stripe confirms the payment actually succeeded.
export async function POST(request: NextRequest) {
  const auth = await requireUserId();
  if (auth.error) return auth.error;

  const body = await request.json().catch(() => null);
  const tierId = typeof body?.tier === "string" ? body.tier : null;
  if (!tierId) {
    return NextResponse.json({ error: "Missing required field: tier" }, { status: 400 });
  }

  const tier = getTier(tierId);
  if (!tier) {
    return NextResponse.json({ error: `Unknown tier "${tierId}"` }, { status: 400 });
  }
  if (tier.priceCents <= 0) {
    return NextResponse.json({ error: "This tier is free — use the claim-free endpoint instead" }, { status: 400 });
  }

  const origin = request.nextUrl.origin;

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: `Simulated Portfolio — ${tier.label} ($${tier.startingBalance.toLocaleString()} starting balance)`,
            description:
              "A one-time fee for access to a paper-trading simulation feature. This is not an investment, and does not purchase any security.",
          },
          unit_amount: tier.priceCents,
        },
        quantity: 1,
      },
    ],
    // metadata carries the info the webhook needs to grant the right
    // balance to the right user once payment is actually confirmed — the
    // webhook is the only thing that ever reads this, never this route.
    metadata: { userId: auth.userId, tier: tier.id },
    success_url: `${origin}/portfolio?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/portfolio?checkout=cancelled`,
  });

  if (!session.url) {
    return NextResponse.json({ error: "Stripe did not return a checkout URL" }, { status: 502 });
  }

  return NextResponse.json({ url: session.url });
}
