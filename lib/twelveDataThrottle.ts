import { randomUUID } from "crypto";

// A single, process-wide throttle for every TwelveData call in this app —
// extracted from what was originally lib/sparklineFetch.ts's own private
// throttle so /api/stock/history (the main chart) can share the exact same
// account-wide quota tracking instead of hitting TwelveData completely
// unthrottled, which was the actual root cause of the AAPL chart's
// rate-limit failures: sparklines were protected, the main chart wasn't,
// and both draw against the same 8-calls/minute free-tier quota.
//
// Confirmed live (see lib/sparklineFetch.ts's original comment history):
// TwelveData enforces its "8/minute" cap against the calendar minute
// ("9 API credits were used, with the current limit being 8... wait for
// the next minute"), not a rolling 60s window — so calls are tracked
// against calendar-minute buckets below, not just spaced apart.
const MIN_CALL_SPACING_MS = 7_600;
const MAX_CALLS_PER_MINUTE = 8;

// Diagnostic only — a random id tied to *module evaluation*, not
// process.pid, so a bundler/dev-server re-evaluating this module shows up
// as a new id even if it happens to land in the same OS process. Directly
// tests whether multiple independent copies of the queue/lastCallAt/
// callsThisMinute state below are running concurrently, which would
// explain call spacing narrower than MIN_CALL_SPACING_MS in the combined
// log output despite each copy individually enforcing it correctly.
const PROCESS_ID = randomUUID().slice(0, 8);

let lastCallAt = 0;
let currentMinuteBucket = -1;
let callsThisMinute = 0;
let queue: Promise<void> = Promise.resolve();

// Confirmed live: once this account's daily credit allowance is used up,
// TwelveData rejects every call with "You have run out of API credits for
// the day" — AND still increments its own reported "used" count for that
// rejected call. Without a breaker, every consumer (sparklines, the main
// chart, price targets) just keeps re-queuing through the throttle above
// exactly as if nothing were wrong, each attempt guaranteed to fail and
// still costing a credit — confirmed live: a single Stock Catalog page
// load (30+ distinct tickers between its ETF/Mag-7 sections and its own
// rows) queues that many attempts at once, and since a client giving up
// on a slow row does NOT cancel the underlying server-side fetch (see
// lib/sparklineFetch.ts's own comment on this), the queue kept draining —
// and kept costing credits — for minutes after the page that started it
// was long gone. This is what took the account from its 800/day cap to
// over 1700 "used" over the course of one afternoon of testing: not one
// runaway call, but the queue never being told to stop once it was
// already hopeless. `markTwelveDataDailyExhausted` trips this the moment
// any call site recognizes that exact error text; every call below then
// rejects immediately, before it would even reach the queue, until the
// cooldown clears.
let dailyExhaustedUntil: number | null = null;

// Conservative relative to "wait for the actual next-day reset" (unknown
// exact instant/timezone for this account) — long enough that a real
// day-long exhaustion isn't hammered every few seconds, short enough that
// a recheck happens well within any single browsing session rather than
// only after a server restart.
const DAILY_EXHAUSTION_RECHECK_MS = 15 * 60_000;

const DAILY_EXHAUSTION_MESSAGE_PATTERN = /run out of api credits for the day/i;

export function isTwelveDataDailyExhaustionMessage(message: string | null | undefined): boolean {
  return typeof message === "string" && DAILY_EXHAUSTION_MESSAGE_PATTERN.test(message);
}

export function markTwelveDataDailyExhausted(): void {
  const alreadyTripped = dailyExhaustedUntil !== null && Date.now() < dailyExhaustedUntil;
  dailyExhaustedUntil = Date.now() + DAILY_EXHAUSTION_RECHECK_MS;
  if (!alreadyTripped) {
    console.warn(
      `[twelvedata] daily quota exhausted — pausing every TwelveData call for ${DAILY_EXHAUSTION_RECHECK_MS / 60_000} minutes rather than continuing to queue guaranteed-to-fail requests`
    );
  }
}

function isTwelveDataDailyExhausted(): boolean {
  if (dailyExhaustedUntil === null) return false;
  if (Date.now() >= dailyExhaustedUntil) {
    dailyExhaustedUntil = null;
    return false;
  }
  return true;
}

// A running total for the current process's lifetime — not a substitute
// for TwelveData's own account-wide daily_usage figure (this only counts
// what THIS process has made, and multiple dev/prod instances or a
// deploy restart would each start back at 0), but it's what makes a
// within-one-process investigation window ("what did the last N page
// loads actually cost") legible without cross-referencing timestamps
// across scattered log lines by hand.
let totalCallsSinceStart = 0;

// Every call site passes a short label identifying itself (e.g.
// "sparkline:AAPL", "history:AAPL:5min") — logged right at the moment a
// call actually clears the throttle and is about to hit the network, so
// this line only ever appears on a genuine cache miss (a cache hit never
// reaches this function at all, being answered by withCache before the
// fetcher — and therefore this call — ever runs).
function exhaustedRejection(label?: string): Error {
  return new Error(`TwelveData daily quota exhausted — skipping call${label ? ` (${label})` : ""} until the cooldown clears`);
}

export function throttledTwelveDataCall<T>(fn: () => Promise<T>, label?: string): Promise<T> {
  // Checked before even touching the queue — a rejection here costs
  // nothing (no network call, no wait), unlike letting this call take its
  // turn in line only to fail exactly the way the last several hundred
  // calls already have.
  if (isTwelveDataDailyExhausted()) {
    return Promise.reject(exhaustedRejection(label));
  }

  const resultPromise = queue.then(async (): Promise<T> => {
    // Re-checked here too, right as this call reaches the front of the
    // queue — a sibling call from the very same batch (e.g. the 30-odd
    // sparkline requests one Stock Catalog page load fires at once) can
    // pass the check above before any of them has failed, then sit queued
    // long enough for an earlier entry to hit the network, discover the
    // account is exhausted, and trip the breaker. Catching it here too —
    // before touching pacing state or the network — is what stops an
    // already-in-flight batch from continuing to burn credits after the
    // first failure, rather than only blocking calls made afterward.
    if (isTwelveDataDailyExhausted()) throw exhaustedRejection(label);

    let minuteBucket = Math.floor(Date.now() / 60_000);
    if (minuteBucket !== currentMinuteBucket) {
      currentMinuteBucket = minuteBucket;
      callsThisMinute = 0;
    }

    if (callsThisMinute >= MAX_CALLS_PER_MINUTE) {
      const msUntilNextMinute = (currentMinuteBucket + 1) * 60_000 - Date.now();
      if (msUntilNextMinute > 0) {
        await new Promise((resolve) => setTimeout(resolve, msUntilNextMinute));
      }
      minuteBucket = Math.floor(Date.now() / 60_000);
      currentMinuteBucket = minuteBucket;
      callsThisMinute = 0;
    }

    const wait = Math.max(0, lastCallAt + MIN_CALL_SPACING_MS - Date.now());
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));

    callsThisMinute++;
    lastCallAt = Date.now();
    totalCallsSinceStart++;
    console.log(
      `[twelvedata] call #${totalCallsSinceStart} this process${label ? `: ${label}` : ""} (${callsThisMinute}/${MAX_CALLS_PER_MINUTE} this minute) [moduleId=${PROCESS_ID} pid=${process.pid}]`
    );

    // fn() runs (and is awaited) right here, inside the queue's own turn,
    // rather than off to the side of it — so the NEXT queued call's
    // exhaustion check above doesn't run until THIS call has well and
    // truly finished, network round trip included, not just its pacing
    // delay. Without this, two calls queued back-to-back can both clear
    // the pacing gate (which only tracks call-start spacing) before
    // either's response comes back, letting the second slip past a
    // breaker trip the first one's failure is about to cause — confirmed
    // live: exactly the gap that let a couple of sparkline calls in the
    // same batch still hit the network moments after the breaker had
    // already tripped from an earlier call in that same batch.
    return fn();
  });

  // `queue` must keep resolving regardless of any individual call's
  // outcome, or every future call chained onto it would silently stop
  // running its own turn forever the first time one call throws.
  queue = resultPromise.then(
    () => undefined,
    () => undefined
  );

  return resultPromise;
}

export function getTwelveDataCallCountSinceStart(): number {
  return totalCallsSinceStart;
}
