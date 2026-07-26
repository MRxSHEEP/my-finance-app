import { NextRequest, NextResponse } from "next/server";

// The app's one existing cron route (/api/daily-briefing) has no request
// verification at all — its "once a day" behavior is enforced entirely by
// its own cache key. These ingestion routes write to Postgres rather than
// just populating a cache, so they get one small addition: if CRON_SECRET
// is set, require it. Vercel Cron sends `Authorization: Bearer
// $CRON_SECRET` automatically when the env var is configured, so this is
// a no-op in an environment that hasn't set it (e.g. local dev, where
// hitting the route directly is exactly how it's tested).
export function checkCronAuth(request: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) return null;

  const header = request.headers.get("authorization");
  if (header !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
