import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { requireOrgAdmin } from "@/lib/orgAuth";
import { prisma } from "@/lib/prisma";
import { SEAT_PRICE_CENTS } from "@/lib/org/seatPricing";

export const dynamic = "force-dynamic";

// Creates a Stripe Checkout Session (hosted, redirect-based — mirrors
// app/api/simulated-portfolio/checkout/route.ts's shape) for a recurring,
// per-seat subscription. This route only ever hands back a session URL; it
// never writes the subscription onto the Organization itself — see
// app/api/webhooks/stripe/route.ts's handleOrgSubscriptionCheckout, the
// only place that happens, and only once Stripe confirms the session
// actually completed.
export async function POST(request: NextRequest) {
  const ctx = await requireOrgAdmin();
  if (ctx.error) return ctx.error;

  const organization = await prisma.organization.findUnique({ where: { id: ctx.organizationId } });
  if (!organization) return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  if (organization.stripeSubscriptionId) {
    return NextResponse.json({ error: "This organization already has an active subscription" }, { status: 409 });
  }

  const seatCount = await prisma.membership.count({ where: { organizationId: ctx.organizationId } });
  const origin = request.nextUrl.origin;

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    // If this org has never had a customer, omit `customer` entirely and
    // let Stripe collect the billing email on the hosted Checkout page
    // itself, rather than requiring an org-level billing-email concept
    // this app doesn't otherwise have.
    customer: organization.stripeCustomerId ?? undefined,
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: { name: "Noble — Organization seat" },
          unit_amount: SEAT_PRICE_CENTS,
          recurring: { interval: "month" },
        },
        quantity: seatCount,
      },
    ],
    // metadata carries what the webhook needs to attach the confirmed
    // subscription to the right org — the webhook is the only thing that
    // ever reads this, never this route.
    metadata: { organizationId: ctx.organizationId },
    success_url: `${origin}/settings/organization?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/settings/organization?checkout=cancelled`,
  });

  if (!session.url) {
    return NextResponse.json({ error: "Stripe did not return a checkout URL" }, { status: 502 });
  }

  return NextResponse.json({ url: session.url });
}
