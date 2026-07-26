import { NextResponse } from "next/server";
import { getNotableHoldersForTicker } from "@/lib/trackers/byTicker";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await params;
  const data = await getNotableHoldersForTicker(ticker);
  return NextResponse.json(data);
}
