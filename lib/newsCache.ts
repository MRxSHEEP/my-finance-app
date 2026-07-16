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
