import { NextRequest, NextResponse } from "next/server";
import { buildTrackerProfile } from "@/lib/trackers/profile";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const profile = await buildTrackerProfile(slug, request.nextUrl.origin);

  if (!profile) {
    return NextResponse.json({ error: "Tracker not found" }, { status: 404 });
  }

  return NextResponse.json(profile);
}
