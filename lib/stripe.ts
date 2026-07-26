import Stripe from "stripe";

// Cached on globalThis for the same reason as lib/prisma.ts's own
// singleton: Next's dev-mode hot-reload would otherwise construct a fresh
// client on every edit.
const globalForStripe = globalThis as unknown as { stripe?: Stripe };

function createStripeClient(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("Server is missing STRIPE_SECRET_KEY configuration");
  }
  // Deliberately never checked in code whether this is a live (sk_live_)
  // or test (sk_test_) key — Stripe's own key prefix is the only gate.
  // Keeping test-mode keys in .env.local (see that file) is what actually
  // keeps this feature from charging real money; see the Simulated
  // Portfolio plan for why this feature stays in test mode until a
  // deliberate, separate decision is made to go live.
  return new Stripe(secretKey);
}

export const stripe = globalForStripe.stripe ?? createStripeClient();

if (process.env.NODE_ENV !== "production") {
  globalForStripe.stripe = stripe;
}
