import { NextRequest, NextResponse } from "next/server";
import { checkCronAuth } from "@/lib/trackers/cronAuth";
import { isCongressPdfIngestionEnabled, CONGRESS_PDF_DISABLED_MESSAGE } from "@/lib/trackers/congressPdfGate";
import { ingestSenatePtrFilings } from "@/lib/trackers/senateEfd";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const authError = checkCronAuth(request);
  if (authError) return authError;

  if (!isCongressPdfIngestionEnabled()) {
    return NextResponse.json({ enabled: false, message: CONGRESS_PDF_DISABLED_MESSAGE });
  }

  const result = await ingestSenatePtrFilings();
  return NextResponse.json({ enabled: true, ...result });
}
