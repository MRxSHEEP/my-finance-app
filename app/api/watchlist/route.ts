import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth-helpers";

// requireUserId() -> auth() reads cookies() internally, but that call is
// buried inside next-auth's own internals rather than a literal
// cookies()/headers() call in this file, so Next's static/dynamic
// analysis can't see it — without forcing this, the route can get
// treated as statically cacheable and silently serve a stale snapshot
// per user regardless of subsequent mutations (same class of bug
// app/api/ticker/route.ts already guards against, for the same reason).
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireUserId();
  if (auth.error) return auth.error;

  const items = await prisma.watchlistItem.findMany({
    where: { userId: auth.userId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ items });
}

export async function POST(request: NextRequest) {
  const auth = await requireUserId();
  if (auth.error) return auth.error;

  const body = await request.json().catch(() => null);
  const symbol = typeof body?.symbol === "string" ? body.symbol.trim().toUpperCase() : "";
  const name = typeof body?.name === "string" && body.name.trim() ? body.name.trim() : undefined;

  if (!symbol) {
    return NextResponse.json({ error: "Missing required field: symbol" }, { status: 400 });
  }

  // Idempotent add: re-starring an already-saved symbol just returns the
  // existing row rather than erroring on the unique constraint.
  const item = await prisma.watchlistItem.upsert({
    where: { userId_symbol: { userId: auth.userId, symbol } },
    update: {},
    create: { userId: auth.userId, symbol, name },
  });

  return NextResponse.json({ item }, { status: 201 });
}
