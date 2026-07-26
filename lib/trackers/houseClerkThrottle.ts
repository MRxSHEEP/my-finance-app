// disclosures-clerk.house.gov has no robots.txt and publishes no explicit
// rate limit (both confirmed live), but it's a small government site, not a
// CDN-backed API — a flat, conservative minimum spacing between requests
// keeps this pipeline from ever looking like abusive scraping traffic, per
// the explicit requirement this pipeline was built under. Wider spacing
// than lib/trackers/edgarThrottle.ts's 120ms deliberately, since EDGAR
// publishes an actual ~10 req/s allowance and this site publishes nothing
// at all to size a limit against.
const MIN_CALL_SPACING_MS = 1500;

let lastCallAt = 0;
let queue: Promise<void> = Promise.resolve();

export function throttledHouseClerkCall<T>(fn: () => Promise<T>): Promise<T> {
  const turn = queue.then(async () => {
    const wait = Math.max(0, lastCallAt + MIN_CALL_SPACING_MS - Date.now());
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    lastCallAt = Date.now();
  });
  queue = turn;
  return turn.then(fn);
}
