import { NextRequest, NextResponse } from "next/server";
import { getPublicShareView } from "@/lib/modelPortfolios/publicView";

export const dynamic = "force-dynamic";

// PUBLIC — no auth of any kind. Looks up by the token ALONE (see
// getPublicShareView's own Prisma query) — there is no portfolio id
// anywhere in this route's path or logic for a token check to be an
// afterthought to. Exists as an independently-curlable, minimal JSON
// contract for this feature's public surface; the public page itself calls
// getPublicShareView directly server-side rather than fetching this route,
// so the rendered page makes zero client-side calls beyond this one
// portfolio's own data.
export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const view = await getPublicShareView(token);
  if (!view) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(view);
}
