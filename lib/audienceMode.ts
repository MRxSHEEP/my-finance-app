import { cookies } from "next/headers";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// A VIEW PREFERENCE, never an entitlement. This module owns reading and
// writing the preference (cookie for signed-out visitors, User.audienceMode
// for signed-in ones) and nothing else — it has no import from and is never
// imported by lib/reportingAuth.ts, lib/complianceAuth.ts, or any
// requireOrgRole/requireFeatureRole function. Those keep gating actual
// advisor-feature access exactly as before, unaware this file exists.
// Switching mode can change which shell/landing page renders; it can never
// change what a request is authorized to return.
export type AudienceMode = "retail" | "advisor";

export const AUDIENCE_MODE_COOKIE = "noble-audience-mode";

function isAudienceMode(value: string | null | undefined): value is AudienceMode {
  return value === "retail" || value === "advisor";
}

export interface ResolvedAudienceMode {
  mode: AudienceMode;
  // False only when a first-time visitor has no cookie/stored preference
  // and nothing else resolved it either — the picker-on-"/" case.
  explicit: boolean;
  // False only for an org member: their mode is a fixed fact of the
  // account, not a preference, and the precedence order below always
  // re-forces "advisor" for them regardless of what's written to
  // User.audienceMode or the cookie — so the chip must not offer a toggle
  // that would silently revert on the very next render. Everyone else
  // (including a signed-in user with no org) gets a real, effective toggle.
  switchable: boolean;
}

// Precedence, same rule everywhere this is read from (see this file's own
// header comment): org membership overrides everything; an explicit
// User.audienceMode beats a leftover pre-login cookie; a cookie only ever
// fills a gap in User.audienceMode (one-way write), never overwrites an
// explicit choice already on the account. Deliberately excludes the
// "landing directly on /advisors" override — that's route-dependent, and
// this function has no route to consider (see ConditionalAppChrome, which
// composes this with the current pathname).
export async function resolveBaseAudienceMode(): Promise<ResolvedAudienceMode> {
  const session = await auth();
  const userId = session?.user?.id;
  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(AUDIENCE_MODE_COOKIE)?.value;
  const cookieMode = isAudienceMode(cookieValue) ? cookieValue : null;

  if (!userId) {
    return cookieMode
      ? { mode: cookieMode, explicit: true, switchable: true }
      : { mode: "retail", explicit: false, switchable: true };
  }

  const [membership, user] = await Promise.all([
    prisma.membership.findFirst({ where: { userId }, select: { id: true } }),
    prisma.user.findUnique({ where: { id: userId }, select: { audienceMode: true } }),
  ]);

  if (membership) {
    return { mode: "advisor", explicit: true, switchable: false };
  }

  if (isAudienceMode(user?.audienceMode)) {
    return { mode: user.audienceMode, explicit: true, switchable: true };
  }

  if (cookieMode) {
    // Gap-filling migration — the account has never explicitly chosen, so
    // the pre-login cookie becomes the account's real preference. One-way
    // and one-time: the next call to this function finds User.audienceMode
    // already set and never reaches this branch again for this account.
    await prisma.user.update({ where: { id: userId }, data: { audienceMode: cookieMode } });
    return { mode: cookieMode, explicit: true, switchable: true };
  }

  return { mode: "retail", explicit: false, switchable: true };
}

// Server-only write path for the mode switcher. Signed out: sets the
// cookie. Signed in: writes User.audienceMode directly (never touches the
// cookie — per the precedence rule, the stored value already wins over any
// cookie the moment it's set, so there's nothing for the cookie to do).
export async function setAudienceMode(mode: AudienceMode): Promise<void> {
  const session = await auth();
  const userId = session?.user?.id;

  if (userId) {
    await prisma.user.update({ where: { id: userId }, data: { audienceMode: mode } });
    return;
  }

  const cookieStore = await cookies();
  cookieStore.set(AUDIENCE_MODE_COOKIE, mode, {
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    path: "/",
  });
}
