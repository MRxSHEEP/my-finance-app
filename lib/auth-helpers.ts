import { NextResponse } from "next/server";
import { auth } from "@/auth";

// Shared by every watchlist/portfolio route: resolves the current
// session's user id, or a ready-to-return 401 response if there isn't
// one. Callers do `const result = await requireUserId(); if (result.error) return result.error;`
export async function requireUserId(): Promise<
  { userId: string; error?: undefined } | { userId?: undefined; error: NextResponse }
> {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return { error: NextResponse.json({ error: "Not signed in" }, { status: 401 }) };
  }

  return { userId };
}
