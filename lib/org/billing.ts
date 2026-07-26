import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";

// Called after every membership-count change (org creation, invite-accept,
// member removal) — a no-op until an org has actually started a
// subscription from /settings/organization. Never throws: a Stripe outage
// must not block adding/removing a member, so failures are logged and
// swallowed rather than propagated.
export async function syncStripeSeatQuantity(organizationId: string): Promise<void> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { stripeSubscriptionItemId: true },
  });
  if (!org?.stripeSubscriptionItemId) return;

  const seatCount = await prisma.membership.count({ where: { organizationId } });

  try {
    await stripe.subscriptionItems.update(org.stripeSubscriptionItemId, { quantity: seatCount });
  } catch (err) {
    console.error(
      `[org-billing] failed to sync seat quantity for org ${organizationId}: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}
