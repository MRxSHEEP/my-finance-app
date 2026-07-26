// SEC EDGAR's fair-access policy asks for no more than ~10 requests/second
// from a single requester. A flat minimum spacing (unlike
// lib/twelveDataThrottle.ts's dual per-minute-bucket + per-call scheme,
// which exists specifically because TwelveData enforces its cap against
// calendar-minute boundaries) is all this needs — EDGAR's limit is a
// straightforward request rate, not a bucketed quota. 120ms spacing caps
// this app at ~8.3 req/s, a safe margin under the 10/s ceiling rather than
// cutting it exactly at the line.
const MIN_CALL_SPACING_MS = 120;

let lastCallAt = 0;
let queue: Promise<void> = Promise.resolve();

export function throttledEdgarCall<T>(fn: () => Promise<T>): Promise<T> {
  const turn = queue.then(async () => {
    const wait = Math.max(0, lastCallAt + MIN_CALL_SPACING_MS - Date.now());
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    lastCallAt = Date.now();
  });
  queue = turn;
  return turn.then(fn);
}
