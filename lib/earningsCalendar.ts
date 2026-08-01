import { withCache } from "@/lib/newsCache";
import { STOCK_CATALOG } from "@/lib/stockCatalog";

// Earnings dates/estimates don't change intraday — 30 min keeps the page
// feeling live without re-hitting Finnhub on every poll from every open tab.
const CACHE_TTL_MS = 30 * 60_000;

// Default window: far enough back to give the "recently reported"
// beat/miss context something to show even after a quiet weekend, and far
// enough forward to cover both the "This Week" and "Next Week" filter tabs
// on /earnings in a single fetch.
const DEFAULT_PAST_DAYS = 7;
const DEFAULT_FUTURE_DAYS = 14;

// A custom date-range picker is user-driven input, not a fixed internal
// window — clamp its span so a typo (or someone fiddling with query
// params directly) can't make this route request months of data from
// Finnhub in one call.
const MAX_CUSTOM_RANGE_DAYS = 60;

// Confirmed live: Finnhub's /calendar/earnings silently caps its response
// at ~1500 raw rows (across ALL tickers, before this module's own catalog
// filter is applied) rather than paginating or erroring — a 21-day
// request came back truncated, and specifically dropped the *earliest*
// dates rather than the latest, so simply requesting a narrower window
// doesn't help once a request's total row count crosses that ceiling.
// Fetching in small date chunks and merging keeps every chunk's raw
// count comfortably below the cap (a 10-day forward-looking window
// measured ~600 raw rows live) regardless of how wide the caller's
// overall from/to span is.
const FINNHUB_CHUNK_DAYS = 7;

const MAG7_SYMBOLS = new Set(["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA"]);

// Same curated ~130-ticker catalog used to gate "notable" companies
// elsewhere in the app (app/api/daily-briefing/route.ts's own earnings
// filtering, the /stocks catalog browser) — Finnhub's broad calendar
// returns 500+ small/micro-cap reports over a two-week window, so this is
// a hard filter, not just a sort priority, matching that established
// precedent rather than inventing a new noise-control mechanism.
const CATALOG_NAME_BY_SYMBOL = new Map(STOCK_CATALOG.map((entry) => [entry.symbol, entry.name]));

export interface EarningsEntry {
  symbol: string;
  name: string;
  date: string; // YYYY-MM-DD
  hour: "bmo" | "amc" | "dmh" | null;
  epsEstimate: number | null;
  epsActual: number | null;
  revenueEstimate: number | null;
  revenueActual: number | null;
  isMag7: boolean;
  // NOT part of the dedupe key (see reconcileEarningsDuplicates below) —
  // confirmed live that Finnhub can label two rows of the SAME real report
  // with different quarter numbers (identical epsActual/revenueActual
  // across "Q2" and "Q3" copies of one AAPL report), so quarter/year are
  // just as unreliable as the estimate fields, not a trustworthy signal
  // that two rows are genuinely different events. Reconciled like any
  // other field: null when a group disagrees on it.
  quarter: number | null;
  year: number | null;
}

interface RawFinnhubEntry {
  symbol?: string;
  date?: string;
  hour?: string;
  epsEstimate?: number | null;
  epsActual?: number | null;
  revenueEstimate?: number | null;
  revenueActual?: number | null;
  quarter?: number | null;
  year?: number | null;
}

// The fields that can actually disagree between two rows sharing the same
// symbol+date+hour — symbol/date/hour are the grouping key itself (agree
// by construction), and name/isMag7 are derived locally from the symbol
// (CATALOG_NAME_BY_SYMBOL / MAG7_SYMBOLS below), never read from Finnhub's
// own varying fields. quarter/year are included here, not in the key —
// confirmed live they can differ between two rows of the same real report
// (see EarningsEntry's own comment on these two fields), so they get
// reconciled like epsEstimate/epsActual/revenueEstimate/revenueActual
// rather than trusted to split genuinely different events apart.
const RECONCILABLE_FIELDS = [
  "epsEstimate",
  "epsActual",
  "revenueEstimate",
  "revenueActual",
  "quarter",
  "year",
] as const;

// Finnhub's /calendar/earnings has been observed live returning more than
// one row for the same symbol+date+hour — apparently distinct
// estimate-revision snapshots of the same event, not distinct events (and
// not reliably distinguishable by quarter/year either — see above). There's
// no documented revision/updated-at/as-of field on this endpoint to know
// which snapshot is newer, so rather than picking one arbitrarily (which
// could silently show a stale or wrong number, including a stale
// epsActual), any field the duplicate rows disagree on is suppressed to
// null instead of guessed at. Every consumer of EarningsEntry already
// renders a null EPS/revenue field as "—" or hides that line entirely
// (they had to, since a not-yet-reported entry has always had epsActual:
// null), so this doesn't introduce a new rendering case, just a new
// reason nulls can appear on an already-reported entry.
function reconcileEarningsDuplicates(entries: EarningsEntry[]): EarningsEntry[] {
  const groups = new Map<string, EarningsEntry[]>();
  for (const entry of entries) {
    const key = `${entry.symbol}|${entry.date}|${entry.hour}`;
    const group = groups.get(key);
    if (group) group.push(entry);
    else groups.set(key, [entry]);
  }

  const result: EarningsEntry[] = [];
  for (const group of groups.values()) {
    if (group.length === 1) {
      result.push(group[0]);
      continue;
    }

    const reconciled = { ...group[0] };
    const conflictedFields: string[] = [];
    for (const field of RECONCILABLE_FIELDS) {
      const values = group.map((entry) => entry[field]);
      const allAgree = values.every((value) => value === values[0]);
      if (!allAgree) {
        conflictedFields.push(field);
        reconciled[field] = null;
      }
    }

    if (conflictedFields.length > 0) {
      console.warn(
        `[earnings-calendar] Suppressed conflicting field(s) for ${reconciled.symbol} on ${reconciled.date}: ` +
          `${conflictedFields.join(", ")} (${group.length} duplicate rows from Finnhub)`
      );
    }

    result.push(reconciled);
  }

  return result;
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function defaultRange(): { from: string; to: string } {
  const today = new Date();
  const from = new Date(today);
  from.setUTCDate(from.getUTCDate() - DEFAULT_PAST_DAYS);
  const to = new Date(today);
  to.setUTCDate(to.getUTCDate() + DEFAULT_FUTURE_DAYS);
  return { from: toIsoDate(from), to: toIsoDate(to) };
}

function normalizeHour(hour: string | undefined): "bmo" | "amc" | "dmh" | null {
  return hour === "bmo" || hour === "amc" || hour === "dmh" ? hour : null;
}

function splitIntoChunks(from: string, to: string, chunkDays: number): Array<{ from: string; to: string }> {
  const chunks: Array<{ from: string; to: string }> = [];
  let cursor = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);

  while (cursor <= end) {
    const chunkEnd = new Date(cursor);
    chunkEnd.setUTCDate(chunkEnd.getUTCDate() + chunkDays - 1);
    const clampedEnd = chunkEnd > end ? end : chunkEnd;
    chunks.push({ from: toIsoDate(cursor), to: toIsoDate(clampedEnd) });

    cursor = new Date(clampedEnd);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return chunks;
}

// Throws (rather than returning []) on any failure — same reasoning as
// lib/stockHistoryCache.ts/lib/sparklineFetch.ts's own TwelveData fetchers:
// letting the failure propagate means withCache's fetcher below never
// reaches its cache.set line, so a rate-limited/failed chunk never gets
// cached as if it genuinely meant "nothing scheduled" for the full
// 30-minute TTL. Confirmed live: a burst of concurrent /api/stock/overview
// calls (rendering many StockLogo rows at once) exhausted this account's
// shared Finnhub quota, and all three calendar chunks for a custom range
// came back 429 — under the old swallow-to-[] behavior that silently
// cached as "No notable earnings in this range" for half an hour even
// though real data existed and a retry moments later would have worked.
async function fetchFinnhubChunk(apiKey: string, from: string, to: string): Promise<RawFinnhubEntry[]> {
  const response = await fetch(
    `https://finnhub.io/api/v1/calendar/earnings?from=${from}&to=${to}&token=${apiKey}`
  );
  if (!response.ok) {
    const bodyText = await response.text().catch(() => "<failed to read body>");
    throw new Error(`chunk ${from}..${to} failed — status ${response.status}: ${bodyText}`);
  }

  const body = await response.json().catch(() => null);
  return Array.isArray(body?.earningsCalendar) ? body.earningsCalendar : [];
}

// Shared by /api/earnings-calendar (the dedicated calendar page) and
// /api/daily-briefing (today's notable earnings as a briefing input) so
// there is exactly one place that calls Finnhub's broad calendar and
// applies the catalog filter — a caller that doesn't pass from/to gets
// the same default window and therefore the same cache entry, so both
// features share one upstream call instead of each fetching separately.
export async function fetchEarningsCalendar(from?: string, to?: string): Promise<EarningsEntry[]> {
  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) return [];

  let range = from && to ? { from, to } : defaultRange();

  // Guard against an out-of-order or excessively wide caller-supplied range.
  const fromDate = new Date(`${range.from}T00:00:00Z`);
  const toDate = new Date(`${range.to}T00:00:00Z`);
  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime()) || toDate < fromDate) {
    range = defaultRange();
  } else {
    const spanDays = (toDate.getTime() - fromDate.getTime()) / 86_400_000;
    if (spanDays > MAX_CUSTOM_RANGE_DAYS) {
      const clampedTo = new Date(fromDate);
      clampedTo.setUTCDate(clampedTo.getUTCDate() + MAX_CUSTOM_RANGE_DAYS);
      range = { from: range.from, to: toIsoDate(clampedTo) };
    }
  }

  const cacheKey = `earnings-calendar:${range.from}:${range.to}`;

  try {
    return await withCache(cacheKey, CACHE_TTL_MS, async (): Promise<EarningsEntry[]> => {
      const chunks = splitIntoChunks(range.from, range.to, FINNHUB_CHUNK_DAYS);
      const chunkResults = await Promise.all(chunks.map((chunk) => fetchFinnhubChunk(apiKey, chunk.from, chunk.to)));
      const entries = chunkResults.flat();

      const mapped = entries
        .filter(
          (entry): entry is RawFinnhubEntry & { symbol: string; date: string } =>
            Boolean(entry.symbol && entry.date && CATALOG_NAME_BY_SYMBOL.has(entry.symbol))
        )
        .map((entry) => ({
          symbol: entry.symbol,
          name: CATALOG_NAME_BY_SYMBOL.get(entry.symbol) ?? entry.symbol,
          date: entry.date,
          hour: normalizeHour(entry.hour),
          epsEstimate: entry.epsEstimate ?? null,
          epsActual: entry.epsActual ?? null,
          revenueEstimate: entry.revenueEstimate ?? null,
          revenueActual: entry.revenueActual ?? null,
          isMag7: MAG7_SYMBOLS.has(entry.symbol),
          quarter: entry.quarter ?? null,
          year: entry.year ?? null,
        }));

      return reconcileEarningsDuplicates(mapped);
    });
  } catch (err) {
    // Caught here (rather than left to propagate) so both callers of this
    // function — this route and /api/daily-briefing — keep their existing
    // "always resolves to an array" contract. The fix above is about what
    // gets cached, not about turning this into a hard error for callers
    // that never expected one.
    console.error(
      `[earnings-calendar] ${range.from}..${range.to} failed: ${err instanceof Error ? err.message : String(err)}`
    );
    return [];
  }
}
