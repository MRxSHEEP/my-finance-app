import { randomBytes } from "crypto";

// 256 bits of entropy, base64url-encoded (~43 chars, URL-safe). Deliberately
// NOT cuid() — this repo's usual id convention — because cuid values are
// time-ordered/structured for row-uniqueness, not designed to resist
// guessing, and this token is a bearer credential for a public
// unauthenticated route, not just a row id (contrast with
// UserCertificate.shareId, a cuid, which is fine for a low-stakes "share
// your own achievement" case but not the bar a client-data share link needs).
export function generateShareToken(): string {
  return randomBytes(32).toString("base64url");
}
