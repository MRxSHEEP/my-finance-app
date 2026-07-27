// Shared by lib/trackers/houseClerk.ts (raw HTML scraping) and
// lib/trackers/secEdgar.ts (raw XML parsing) — both extract text straight
// out of markup via regex rather than a real parser, so neither ever
// decoded entities back to plain text (confirmed live: House Clerk
// escapes quoted nicknames as `&quot;`, and SEC EDGAR's XML — validly,
// since a bare `&` isn't legal XML — escapes issuer names like
// "Johnson & Johnson" as `&amp;`). Covers the small, fixed set of named
// entities XML/HTML actually needs here (quotes, ampersand, angle
// brackets, non-breaking space) plus numeric entities generally, rather
// than pulling in a full HTML-parsing dependency for this narrow need.
const NAMED_ENTITIES: Record<string, string> = {
  quot: '"',
  apos: "'",
  amp: "&",
  lt: "<",
  gt: ">",
  nbsp: " ",
};

export function decodeHtmlEntities(text: string): string {
  return text.replace(/&(#\d+|#x[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, entity: string) => {
    if (entity.startsWith("#x") || entity.startsWith("#X")) {
      return String.fromCodePoint(parseInt(entity.slice(2), 16));
    }
    if (entity.startsWith("#")) {
      return String.fromCodePoint(parseInt(entity.slice(1), 10));
    }
    return NAMED_ENTITIES[entity] ?? match;
  });
}
