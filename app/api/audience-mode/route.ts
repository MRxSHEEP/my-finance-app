import { NextRequest, NextResponse } from "next/server";
import { setAudienceMode } from "@/lib/audienceMode";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const mode = body?.mode;

  if (mode !== "retail" && mode !== "advisor") {
    return NextResponse.json({ error: "mode must be 'retail' or 'advisor'" }, { status: 400 });
  }

  await setAudienceMode(mode);
  return NextResponse.json({ mode });
}
