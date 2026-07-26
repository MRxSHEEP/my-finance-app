import { prisma } from "@/lib/prisma";

type CacheEntry<T> = { expiresAt: number; data: T };

const cache = new Map<string, CacheEntry<unknown>>();

// A tiny in-memory, per-process TTL cache. Its job is to decouple "how
// often a client polls our route" from "how often we actually hit the
// upstream news API" — multiple browser tabs, page reloads, or a poll
// firing slightly early should never cost more than one upstream request
// per key within the TTL window.
export async function withCache<T>(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>
): Promise<T> {
  const now = Date.now();
  const existing = cache.get(key) as CacheEntry<T> | undefined;

  if (existing && existing.expiresAt > now) {
    return existing.data;
  }

  const data = await fetcher();
  cache.set(key, { expiresAt: now + ttlMs, data });
  return data;
}

// ---------------------------------------------------------------------
// Stale-on-failure fallback
// ---------------------------------------------------------------------

interface StaleEntry<T> {
  data: T;
  fetchedAt: number;
}

// Separate, TTL-less "last known good" store per key, kept for the whole
// process lifetime — mirrors lib/sparklineFetch.ts's own staleCache/
// FAILURE_BACKOFF_MS pattern (built for the exact same TwelveData quota-
// exhaustion failure mode), generalized here so every withCache consumer
// gets the same "serve the last successful result instead of a raw error"
// behavior for free, rather than each route re-implementing its own stale
// cache the way sparklines had to. Used only by non-`persistent` callers
// (see below) — today, that's the Finnhub-backed per-ticker caches (stock
// overview, logos), which are far higher-cardinality than the Marketaux
// news routes and don't need to survive a restart.
const staleGoodCache = new Map<string, StaleEntry<unknown>>();
const lastFailureAt = new Map<string, number>();

// How long to hold off retrying a key after its fetcher reports failure,
// before trying the network again — without this, a sustained outage/quota
// exhaustion turns every request for that key into a wasted upstream call
// even though the answer (stale fallback data) is already known.
const FAILURE_BACKOFF_MS = 60_000;

export interface StaleFallbackResult<T> {
  data: T;
  stale: boolean;
  staleFetchedAt: number | null;
}

// Postgres-backed equivalent of staleGoodCache for `persistent` callers —
// read/written only on the two paths that actually need it (a successful
// fetch's write, a failure's stale-read), the same as the in-memory Map
// below; never touched on the hot "fresh cache hit" path above, so a
// live fetch succeeding within its TTL window never pays for a DB round
// trip. Failures here are swallowed (logged, not thrown): a Postgres
// hiccup should degrade this back to "no stale data available," never
// crash a request that would otherwise have succeeded.
async function readPersistentStale<T>(key: string): Promise<StaleEntry<T> | null> {
  try {
    const row = await prisma.newsCache.findUnique({ where: { key } });
    if (!row) return null;
    return { data: row.payload as unknown as T, fetchedAt: row.fetchedAt.getTime() };
  } catch (err) {
    console.error(`[newsCache] failed to read persistent stale entry for "${key}": ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

async function writePersistentStale<T>(key: string, data: T, fetchedAt: number): Promise<void> {
  try {
    await prisma.newsCache.upsert({
      where: { key },
      // Prisma's Json input type wants a plain JSON-serializable value, not
      // a typed object — same cast-through pattern already used for
      // LearningProgress.quizScores elsewhere in this codebase.
      create: { key, payload: data as unknown as object, fetchedAt: new Date(fetchedAt) },
      update: { payload: data as unknown as object, fetchedAt: new Date(fetchedAt) },
    });
  } catch (err) {
    console.error(`[newsCache] failed to write persistent stale entry for "${key}": ${err instanceof Error ? err.message : String(err)}`);
  }
}

// Like withCache, but on failure (per `isSuccess`) falls back to the most
// recent successful result for this key instead of propagating the failed
// fetch — the failed value is never written into the TTL cache, so a
// transient outage can't lock in a negative result for the full TTL window.
//
// `persistent` backs the stale fallback with Postgres instead of the
// in-memory Map, so cached articles survive a server restart/redeploy.
// Opt in only for low-cardinality, worth-persisting feeds (the Marketaux
// news routes have ~10 distinct keys total) — left false (the default) for
// high-cardinality per-ticker caches that don't need cross-restart
// durability and shouldn't take on DB I/O for every ticker ever viewed.
export async function withCacheAndFallback<T>(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>,
  isSuccess: (data: T) => boolean,
  persistent = false
): Promise<StaleFallbackResult<T>> {
  const now = Date.now();
  const existing = cache.get(key) as CacheEntry<T> | undefined;
  if (existing && existing.expiresAt > now) {
    return { data: existing.data, stale: false, staleFetchedAt: null };
  }

  const failedAt = lastFailureAt.get(key);
  if (failedAt !== undefined && now - failedAt < FAILURE_BACKOFF_MS) {
    const stale = persistent
      ? await readPersistentStale<T>(key)
      : (staleGoodCache.get(key) as StaleEntry<T> | undefined);
    if (stale) return { data: stale.data, stale: true, staleFetchedAt: stale.fetchedAt };
  }

  const data = await fetcher();

  if (isSuccess(data)) {
    cache.set(key, { expiresAt: now + ttlMs, data });
    if (persistent) {
      await writePersistentStale(key, data, now);
    } else {
      staleGoodCache.set(key, { data, fetchedAt: now });
    }
    lastFailureAt.delete(key);
    return { data, stale: false, staleFetchedAt: null };
  }

  lastFailureAt.set(key, now);
  const stale = persistent
    ? await readPersistentStale<T>(key)
    : (staleGoodCache.get(key) as StaleEntry<T> | undefined);
  if (stale) return { data: stale.data, stale: true, staleFetchedAt: stale.fetchedAt };
  return { data, stale: false, staleFetchedAt: null };
}
