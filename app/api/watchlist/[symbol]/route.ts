import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth-helpers";

export const dynamic = "force-dynamic";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const auth = await requireUserId();
  if (auth.error) return auth.error;

  const { symbol } = await params;

  // Case-insensitive: stock tickers are stored uppercase, crypto ids
  // lowercase, and this route doesn't know which one it's deleting —
  // matching insensitively works for either without needing assetType.
  // deleteMany rather than delete: idempotent (a repeat/late request for
  // an already-removed symbol is a no-op, not a 404/thrown error).
  await prisma.watchlistItem.deleteMany({
    where: { userId: auth.userId, symbol: { equals: decodeURIComponent(symbol), mode: "insensitive" } },
  });

  return NextResponse.json({ ok: true });
}
