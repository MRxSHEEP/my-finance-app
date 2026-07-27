import legislatorBioguideIds from "@/lib/trackers/legislatorBioguideIds.json";

// Maps a tracked congress member's stored name to their official Bioguide
// ID via a name -> id index built from theunitedstates.io's public-domain
// congress-legislators dataset (U.S. government work, no licensing
// restriction) — current members plus historical members whose last term
// ended 2019 or later, covering the "recently departed" filings this
// pipeline's rolling House Clerk window can still surface. Regenerable via
// build-final-legislator-map-tmp.cjs (run once, output committed here —
// this dataset only changes every election cycle, not worth a live fetch
// per request).
//
// Matched by name rather than by Bioguide ID directly because this app's
// own House Clerk/Senate eFD ingestion has no Bioguide ID of its own to
// key off (confirmed: neither pipeline captures one) — name matching is
// inherently imperfect (a nickname/title-formatting mismatch between the
// House Clerk's raw text and the reference dataset won't match), so a
// miss here is expected and falls back to the generic person icon rather
// than guessing.
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/["'.]/g, "")
    .replace(/\b(jr|sr|ii|iii|iv|v)\b\.?/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

const NAME_TO_BIOGUIDE: Record<string, string> = legislatorBioguideIds;

// Official headshots (225x275, the same size unitedstates/images provides
// for its own site listings) served from jsdelivr's GitHub CDN mirror
// rather than raw.githubusercontent.com directly — that host isn't meant
// for production hotlinking and rate-limits/blocks it, confirmed live
// (jsdelivr resolved the same file cleanly). Public-domain U.S. government
// works (House/Senate member photos), same licensing basis as the
// Bioguide data itself.
export function getCongressPhotoUrl(name: string): string | null {
  const bioguideId = NAME_TO_BIOGUIDE[normalizeName(name)];
  if (!bioguideId) return null;
  return `https://cdn.jsdelivr.net/gh/unitedstates/images@gh-pages/congress/225x275/${bioguideId}.jpg`;
}
