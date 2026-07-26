import { NextRequest, NextResponse } from "next/server";
import { checkCronAuth } from "@/lib/trackers/cronAuth";
import { ingestInsiderForm4 } from "@/lib/trackers/insiderForm4";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const authError = checkCronAuth(request);
  if (authError) return authError;

  const results = await ingestInsiderForm4();
  return NextResponse.json({ results });
}
