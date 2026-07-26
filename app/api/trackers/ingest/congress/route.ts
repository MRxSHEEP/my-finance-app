import { NextRequest, NextResponse } from "next/server";
import { checkCronAuth } from "@/lib/trackers/cronAuth";
import { ingestCongressTrades } from "@/lib/trackers/congress";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const authError = checkCronAuth(request);
  if (authError) return authError;

  const result = await ingestCongressTrades();
  return NextResponse.json(result);
}
