import { NextRequest, NextResponse } from "next/server";
import { getPublicShareView } from "@/lib/modelPortfolios/publicView";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const view = await getPublicShareView(token);
  if (!view) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(view);
}
