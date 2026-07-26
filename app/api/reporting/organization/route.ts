import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Mirrors app/api/compliance/organization/route.ts's GET exactly, resolved
// for the "reporting" feature area instead. No POST here — organization
// creation stays Compliance's sole entry point; a user with no org sees a
// message linking to /compliance (handled client-side).
export async function GET() {
  const auth = await requireUserId();
  if (auth.error) return auth.error;

  const membership = await prisma.membership.findFirst({
    where: { userId: auth.userId },
    include: { organization: true, featureRoleGrants: true },
  });

  if (!membership) return NextResponse.json({ organization: null });

  const role =
    membership.orgRole === "admin"
      ? "admin"
      : membership.featureRoleGrants.find((g) => g.featureArea === "reporting")?.role ?? null;

  return NextResponse.json({
    organization: {
      id: membership.organization.id,
      name: membership.organization.name,
      // Additive fields for the Peer Benchmarking Dashboard's live-DOM
      // branding (needed for its client-side PNG export) — GET
      // /api/org/organization is Admin-gated and wrong for a plain
      // advisor, so this already-any-member-accessible route carries
      // branding instead. Existing consumers (Reporting, Model Portfolios)
      // only ever destructure {id, name}, so this is a pure addition.
      logoUrl: membership.organization.logoUrl,
      brandColor: membership.organization.brandColor,
    },
    role,
  });
}
