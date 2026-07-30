// Pure, dependency-free (no fetch/API-key code, unlike lib/newsApi.ts) so
// it's safe to import from both server code and client components without
// bundling that whole file's Marketaux integration into the browser.
// Reused by lib/newsApi.ts's own classifyCategory (the general News
// feed's "Earnings" category) and by the Earnings Calendar's in-place
// detail view (to prioritize a ticker's own earnings-relevant articles
// within its general news list) — same keyword anchors, one definition.
export const EARNINGS_ANCHOR_TERMS = [
  "earnings",
  "quarterly results",
  "eps",
  "guidance",
  "beats estimates",
  "misses estimates",
  "revenue beat",
  "revenue miss",
  "earnings call",
  "earnings report",
  "q1 results",
  "q2 results",
  "q3 results",
  "q4 results",
];

export function isEarningsRelevant(article: { title: string; description?: string | null }): boolean {
  const text = ` ${article.title} ${article.description ?? ""} `.toLowerCase();
  return EARNINGS_ANCHOR_TERMS.some((term) => text.includes(term));
}
