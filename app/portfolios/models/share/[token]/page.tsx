import { notFound } from "next/navigation";
import { getPublicShareView } from "@/lib/modelPortfolios/publicView";
import PublicModelPortfolioView from "@/components/modelPortfolios/PublicModelPortfolioView";

// Explicit, not implicit — guarantees no static-caching layer could ever
// serve a stale pre-revocation response (every request re-runs
// getPublicShareView's live DB query). Deliberately unauthenticated, same
// as app/certificates/[shareId]/page.tsx's precedent: access control is
// the token itself (256-bit random, see lib/modelPortfolios/shareToken.ts),
// not a session check.
export const dynamic = "force-dynamic";

export default async function PublicModelPortfolioPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const view = await getPublicShareView(token);
  if (!view) notFound();

  return <PublicModelPortfolioView view={view} />;
}
