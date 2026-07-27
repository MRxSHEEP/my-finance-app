// Curated slug -> company domain map for the Hedge Funds tracked here
// (see lib/trackers/thirteenF.ts's SEEDED_FUNDS) — a small, genuinely
// fixed set of privately-held asset managers with no public stock ticker,
// so Finnhub's company-profile logo lookup (which Company Insiders
// trackers use instead, see EntityLogo.tsx) has nothing to resolve them
// against. A hand-verified allowlist rather than a live per-name
// logo-guessing API, since a wrong domain guess would just be a
// mismatched logo. An entity with no entry here (or a domain whose
// favicon fails to load) falls back to the existing generic type icon.
//
// The actual image source is Google's public, key-free favicon endpoint,
// not Clearbit's Logo API — Clearbit's service was shut down in Dec 2025
// (confirmed live via DNS failure, and via its own changelog — see
// app/page.tsx's ScatteredLogos, which hit the same issue first).
export const TRACKER_COMPANY_DOMAINS: Record<string, string> = {
  "berkshire-hathaway": "berkshirehathaway.com",
  "bridgewater-associates": "bridgewater.com",
  "citadel-advisors": "citadel.com",
  "renaissance-technologies": "rentec.com",
};

// Resolving a domain to its favicon URL is pure string interpolation, not
// a network call — there's nothing to fetch-and-cache for the URL itself.
// The actual logo bytes come from Google's CDN via a plain <img src>, so
// the browser's own HTTP cache (not app code) is what avoids re-fetching
// them on every page load, the same as any other <img> tag.
export function getTrackerLogoUrl(slug: string, size = 128): string | null {
  const domain = TRACKER_COMPANY_DOMAINS[slug];
  if (!domain) return null;
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=${size}`;
}
