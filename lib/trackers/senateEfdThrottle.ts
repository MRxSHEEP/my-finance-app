// efdsearch.senate.gov has no robots.txt (confirmed live), but its search
// endpoint was observed live to intermittently return a 503 "Site Under
// Maintenance" page on requests seconds apart — genuinely unclear whether
// that's real maintenance or a lightweight anti-automation response, and
// deliberately not probed further to find out (see lib/trackers/senateEfd.ts's
// own comment). Spacing is wider than the House Clerk throttle for the same
// reason: no published limit to size against, plus this site in particular
// has shown signs of being rate-sensitive.
const MIN_CALL_SPACING_MS = 2000;

let lastCallAt = 0;
let queue: Promise<void> = Promise.resolve();

export function throttledSenateEfdCall<T>(fn: () => Promise<T>): Promise<T> {
  const turn = queue.then(async () => {
    const wait = Math.max(0, lastCallAt + MIN_CALL_SPACING_MS - Date.now());
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    lastCallAt = Date.now();
  });
  queue = turn;
  return turn.then(fn);
}
