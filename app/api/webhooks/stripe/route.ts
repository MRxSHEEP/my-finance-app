import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { getTier } from "@/lib/simulatedTrading/tiers";

export const dynamic = "force-dynamic";

// The ONLY place a paid-tier SimulatedPortfolio row (mode:"payment") or an
// org's subscription (mode:"subscription") is ever created/updated —
// deliberately never a client-side success-redirect page, which can be
// skipped, closed, or spoofed. Stripe signs every webhook request, so
// `request.text()` (the raw, unparsed body — App Router route handlers
// never auto-parse a request body, so no special config is needed for
// this, unlike the old Pages Router's `api.bodyParser: false`) plus the
// `stripe-signature` header is what proves this request really came from
// Stripe and really reflects a confirmed payment/subscription event.
export async function POST(request: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json({ error: "Server is missing STRIPE_WEBHOOK_SECRET configuration" }, { status: 500 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    console.error(`[stripe-webhook] signature verification failed: ${err instanceof Error ? err.message : String(err)}`);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;

    if (session.mode === "payment") {
      await handleSimulatedPortfolioCheckout(session);
    } else if (session.mode === "subscription") {
      await handleOrgSubscriptionCheckout(session);
    }

    return NextResponse.json({ received: true });
  }

  if (event.type === "customer.subscription.deleted") {
    const subscription = event.data.object as Stripe.Subscription;
    await prisma.organization.updateMany({
      where: { stripeSubscriptionId: subscription.id },
      data: { stripeSubscriptionId: null, stripeSubscriptionItemId: null },
    });
    return NextResponse.json({ received: true });
  }

  // Acknowledge every other event type without acting on it — Stripe
  // retries on anything other than a 2xx, and this endpoint only cares
  // about the event types above.
  return NextResponse.json({ received: true });
}

async function handleSimulatedPortfolioCheckout(session: Stripe.Checkout.Session): Promise<void> {
  if (session.payment_status !== "paid") return;

  const userId = session.metadata?.userId;
  const tierId = session.metadata?.tier;
  if (!userId || !tierId) {
    console.error(`[stripe-webhook] checkout.session.completed for ${session.id} is missing userId/tier metadata`);
    return;
  }

  const tier = getTier(tierId);
  if (!tier) {
    console.error(`[stripe-webhook] checkout.session.completed for ${session.id} references unknown tier "${tierId}"`);
    return;
  }

  const paymentIntentId =
    typeof session.payment_intent === "string" ? session.payment_intent : (session.payment_intent?.id ?? null);

  // upsert keyed on the unique stripeCheckoutSessionId — Stripe can and
  // does retry webhook delivery, so a repeat delivery of the same
  // already-processed session must never grant a second portfolio.
  await prisma.simulatedPortfolio.upsert({
    where: { stripeCheckoutSessionId: session.id },
    update: {},
    create: {
      userId,
      tier: tier.id,
      startingBalance: tier.startingBalance,
      cashBalance: tier.startingBalance,
      priceCents: tier.priceCents,
      stripeCheckoutSessionId: session.id,
      stripePaymentIntentId: paymentIntentId,
    },
  });
}

async function handleOrgSubscriptionCheckout(session: Stripe.Checkout.Session): Promise<void> {
  const organizationId = session.metadata?.organizationId;
  if (!organizationId) {
    console.error(`[stripe-webhook] subscription checkout.session.completed for ${session.id} is missing organizationId metadata`);
    return;
  }

  const subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
  const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
  if (!subscriptionId || !customerId) {
    console.error(`[stripe-webhook] subscription checkout.session.completed for ${session.id} is missing subscription/customer id`);
    return;
  }

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const subscriptionItemId = subscription.items.data[0]?.id;
  if (!subscriptionItemId) {
    console.error(`[stripe-webhook] subscription ${subscriptionId} has no line items`);
    return;
  }

  await prisma.organization.update({
    where: { id: organizationId },
    data: {
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
      stripeSubscriptionItemId: subscriptionItemId,
    },
  });
}
