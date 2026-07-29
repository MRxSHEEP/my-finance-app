// General-purpose press-release wire services — they syndicate
// announcements for every industry (automotive, consumer audio,
// retail...), not just financial ones, so an article from one of these
// is excluded unconditionally regardless of what topic/entity matching
// let through. Checked against both the article's own URL host and its
// reported source name (Marketaux doesn't always expose the underlying
// article's real host in `source`). This is a publisher-identity check,
// not the keyword/topic filtering NewsAPI needed — kept even after
// consolidating onto Marketaux since a wire-syndicated press release can
// still carry a recognized ticker entity without being editorial content.
const WIRE_SERVICE_DOMAINS = ["prnewswire.com", "globenewswire.com", "businesswire.com", "prweb.com", "accesswire.com"];
const WIRE_SERVICE_NAME_PATTERNS = [
  "pr newswire",
  "prnewswire",
  "globenewswire",
  "globe newswire",
  "business wire",
  "businesswire",
  "prweb",
  "accesswire",
];

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

export function isFromWireService(article: NewsArticle): boolean {
  const host = hostnameOf(article.url);
  if (WIRE_SERVICE_DOMAINS.some((domain) => host === domain || host.endsWith(`.${domain}`))) return true;
  const sourceName = article.source.toLowerCase();
  return WIRE_SERVICE_NAME_PATTERNS.some((pattern) => sourceName.includes(pattern));
}

// Curated large-cap tickers reused across every general (non-ticker-
// specific) stock/markets feed — Marketaux's own `symbols` + entity
// tagging does the relevance work now, so this is the one editorial
// judgment call left: which companies count as "big tech/large cap"
// coverage. Kept as a single shared list rather than each route
// redeclaring a near-identical set.
export const MAJOR_STOCK_SYMBOLS = "AAPL,MSFT,GOOGL,AMZN,NVDA,META,TSLA,JPM,WMT";

// Marketaux represents crypto entities with a "<TICKER>USD" symbol (e.g.
// Bitcoin is "BTCUSD", not bare "BTC") — confirmed against their
// documented entity examples. Mirrors the same top-8-by-volume set
// already used for the crypto page's own "Top 8 Most-Traded" section
// (see app/crypto/page.tsx's TOP8_SYMBOLS) for a consistent identity.
export const MAJOR_CRYPTO_SYMBOLS = "BTCUSD,ETHUSD,BNBUSD,SOLUSD,XRPUSD,DOGEUSD,ADAUSD,AVAXUSD";

// Every category-scoped route (crypto/commodities/stock news) already
// knows its own single category by construction and tags every article
// with it directly. The general (cross-market) News feed is the one
// consumer that actually needs to tell articles apart — see
// classifyCategory below — so this list is a superset covering both uses.
export type NewsCategory = "Markets" | "Stocks" | "Crypto" | "Commodities" | "Earnings" | "Economy";

export type NewsArticle = {
  title: string;
  description: string | null;
  source: string;
  publishedAt: string | null;
  url: string;
  imageUrl: string | null;
  category?: NewsCategory;
  // Internal only — the distinct Marketaux entity types matched on this
  // article (e.g. ["equity"], ["cryptocurrency"]). Populated for every
  // article regardless of caller, but only the general News feed's
  // classifyCategory() reads it; routes that already know their own feed's
  // category (crypto/commodities/stock-specific) ignore it and should strip
  // it before returning JSON, the same as classifyCategory's callers do.
  entityTypes?: string[];
  // True only for a Noble Generated News article (see
  // lib/generatedNews/feedMerge.ts) — every real Marketaux article omits
  // this entirely rather than setting it false, so `article.isAiGenerated`
  // is a safe truthy check on the wire. Drives the gold "Noble Generated
  // News" label in components/ArticleCard.tsx and the internal (not
  // external) link target.
  isAiGenerated?: boolean;
};

// Distinguishes *why* a Marketaux request failed so callers/routes can
// report something more useful than a flat "request failed" — e.g. a rate
// limit (retry shortly) vs. an auth problem (needs a human to fix the key)
// vs. a transient 5xx/network blip (just try again next cycle).
export type MarketauxFailureReason =
  | "not_configured"
  | "quota_exceeded"
  | "rate_limited"
  | "unauthorized"
  | "server_error"
  | "network_error"
  | "unknown";

export interface MarketauxErrorDetail {
  reason: MarketauxFailureReason;
  status?: number;
  message: string;
}

export type SourceResult = { articles: NewsArticle[]; ok: boolean; errorDetail?: MarketauxErrorDetail };

// ---------------------------------------------------------------------
// Recency enforcement
// ---------------------------------------------------------------------

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// Live-tested bug (back when NewsAPI was still in the mix): month-plus-
// old articles were showing up across every news section once a
// domain-restricted query's fresh matching pool ran dry and a provider's
// own `sortBy=publishedAt` had to return *something*. Kept as a hard,
// provider-independent floor even now that Marketaux is the only source,
// since nothing here depends on which provider produced the list.
export const MAX_ARTICLE_AGE_MS = 7 * ONE_DAY_MS;

// How far the "today came up empty" fallback is allowed to widen before
// giving up and returning whatever (possibly few, possibly zero)
// articles it found — never the unbounded "whatever's most recent"
// query this bug came from.
export const FALLBACK_WINDOW_MS = 3 * ONE_DAY_MS;

// Live-confirmed: Marketaux's `published_after` rejects a plain
// `Date.toISOString()` value with a 400 ("malformed_parameters — The
// published_after parameter(s) are incorrectly formatted"). It wants the
// same millisecond-less, Z-less shape already used for the "today" tier
// elsewhere in this file (`${todayIso}T00:00:00`) — this just generalizes
// that same shape to an arbitrary Date so every fallback-window query
// can use it too, instead of only the exact-midnight "today" case.
export function toMarketauxDate(date: Date): string {
  return date.toISOString().slice(0, 19);
}

// Applied after fetching, as the final, non-negotiable cap — independent
// of whatever `published_after` value a given fetch used, so a provider
// that doesn't strictly enforce its own date filter can't leak stale
// articles through.
export function filterRecentArticles(
  articles: NewsArticle[],
  maxAgeMs: number = MAX_ARTICLE_AGE_MS
): NewsArticle[] {
  const cutoff = Date.now() - maxAgeMs;
  return articles.filter((article) => {
    if (!article.publishedAt) return false;
    const publishedTime = new Date(article.publishedAt).getTime();
    return Number.isFinite(publishedTime) && publishedTime >= cutoff;
  });
}

// ---------------------------------------------------------------------
// Marketaux (https://api.marketaux.com/v1/news/all) — sole news source.
// NewsAPI was removed app-wide: it had no ticker/entity awareness of its
// own, which is what all the manual keyword-matching machinery that used
// to live in this file (and in each topic route) existed to compensate
// for. Marketaux is a purpose-built financial news API with native
// entity recognition (`symbols`, `entity_types`, `must_have_entities`),
// so that compensating machinery is gone along with NewsAPI rather than
// carried forward for a single, already entity-aware source.
// ---------------------------------------------------------------------

type RawMarketauxArticle = {
  title?: string;
  description?: string | null;
  url?: string;
  image_url?: string | null;
  published_at?: string;
  source?: string;
  // Live-confirmed against the real API response: each matched entity
  // carries its own `type` ("equity", "cryptocurrency", etc.) plus an
  // `industry` sub-classification for equities — there's no "commodity" or
  // "macro" entity type, which is why classifyCategory below still needs
  // keyword anchors for those two categories rather than reading them
  // straight off an entity field the way Stocks/Crypto can.
  entities?: Array<{ type?: string }>;
};

function cleanMarketauxArticles(raw: RawMarketauxArticle[]): NewsArticle[] {
  return raw
    .filter((a) => a.title && a.url)
    .map((a) => ({
      title: a.title as string,
      description: a.description ?? null,
      source: a.source ?? "Unknown",
      publishedAt: a.published_at ?? null,
      url: a.url as string,
      imageUrl: a.image_url ?? null,
      entityTypes: Array.isArray(a.entities)
        ? [...new Set(a.entities.map((e) => e.type).filter((t): t is string => typeof t === "string"))]
        : [],
    }));
}

// ---------------------------------------------------------------------
// Category classification (general News feed only)
// ---------------------------------------------------------------------

// Shared with app/api/commodities/news/route.ts's own dedicated commodity
// feed, so an article is recognized as commodity-flavored identically
// whether it showed up there or in the general News feed's classifier
// below — a single term list, not two copies that could drift apart.
export const COMMODITY_ANCHOR_TERMS = [
  "gold",
  "silver",
  "oil",
  "crude",
  "natural gas",
  "copper",
  "bullion",
  "brent",
  "wti",
  "opec",
  "barrel",
  "ounce",
  "futures",
  "commodity",
  "commodities",
  "production",
  "inventory",
  "reserve",
  "reserves",
  "wheat",
  "corn",
  "soybean",
  "soybeans",
  "grain",
  "metals",
];
export const COMMODITY_DENYLIST_TERMS = [
  "wedding ring",
  "engagement ring",
  "jewelry",
  "jewellery",
  "necklace",
  "bracelet",
  "earrings",
  "vehicle",
  "sedan",
  "suv",
  "coupe",
  "convertible",
  "horsepower",
  "mileage",
  "supercharged",
  "test drive",
  "dealership",
  "land rover",
  "range rover",
  "for sale by owner",
  "race",
  "racing",
  "speedway",
  "nascar",
];

// Marketaux has no native "earnings" or "macro" entity type, so these two
// categories are keyword-anchored the same way Commodities already is —
// applied only within the general News feed's already entity-scoped
// result set, not as a standalone query (see classifyCategory below).
const EARNINGS_ANCHOR_TERMS = [
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

const ECONOMY_ANCHOR_TERMS = [
  "federal reserve",
  "the fed",
  "fomc",
  "inflation",
  "consumer price index",
  " cpi ",
  "gdp",
  "jobs report",
  "unemployment rate",
  "interest rate",
  "rate cut",
  "rate hike",
  "recession",
  "treasury yield",
];

function matchesAnyTerm(text: string, terms: string[]): boolean {
  return terms.some((term) => text.includes(term));
}

// Derives a real per-article category for the general (cross-market) News
// feed — entity type first (most reliable signal Marketaux gives us),
// then keyword anchors for the topic-level categories it has no entity
// type for at all. Falls back to "Markets" only when nothing more specific
// matched, rather than defaulting every article to it unconditionally the
// way this feed used to.
export function classifyCategory(article: Pick<NewsArticle, "title" | "description" | "entityTypes">): NewsCategory {
  const text = ` ${article.title} ${article.description ?? ""} `.toLowerCase();
  const entityTypes = article.entityTypes ?? [];

  if (entityTypes.includes("cryptocurrency")) return "Crypto";
  if (matchesAnyTerm(text, EARNINGS_ANCHOR_TERMS)) return "Earnings";
  if (matchesAnyTerm(text, ECONOMY_ANCHOR_TERMS)) return "Economy";
  if (matchesAnyTerm(text, COMMODITY_ANCHOR_TERMS) && !matchesAnyTerm(text, COMMODITY_DENYLIST_TERMS)) {
    return "Commodities";
  }
  if (entityTypes.some((t) => t === "equity" || t === "index" || t === "etf")) return "Stocks";
  return "Markets";
}

// Tags an article with its classified category and drops the internal
// entityTypes field before it goes out over the wire — used by the
// general News feed's grid and ticker routes right before responding.
export function classifyAndStripEntityTypes(article: NewsArticle): NewsArticle {
  const category = classifyCategory(article);
  const clean: NewsArticle = {
    title: article.title,
    description: article.description,
    source: article.source,
    publishedAt: article.publishedAt,
    url: article.url,
    imageUrl: article.imageUrl,
    category,
  };
  return clean;
}

// Strips an API-key-bearing query param before a URL is ever logged —
// never print any part of a credential's value, even to server-side
// console output.
function redactApiKey(url: string, paramName: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.searchParams.has(paramName)) {
      parsed.searchParams.set(paramName, "[redacted]");
    }
    return parsed.toString();
  } catch {
    return "<unparseable url>";
  }
}

function buildMarketauxUrl(apiKey: string, params: Record<string, string>): string {
  const search = new URLSearchParams({
    sort: "published_at",
    language: "en",
    ...params,
    api_token: apiKey,
  });
  return `https://api.marketaux.com/v1/news/all?${search.toString()}`;
}

// Live-confirmed (direct probe requests against this account): TWO
// distinct pairs of headers are involved, not one.
// `x-ratelimit-limit`/`x-ratelimit-remaining` is a short-window
// request-rate limit (e.g. 30 per minute). `x-usagelimit-limit`/
// `x-usagelimit-remaining` is the account's actual daily usage
// allowance (confirmed live on a successful 200 response: limit=100,
// remaining=30) — this pair was missed when this tracker was first
// built, because the only probe available at that time was a 402
// (usage_limit_reached) response, and that specific failure response
// didn't include it. When the daily allowance is fully exhausted,
// Marketaux answers every request with HTTP 402 and body
// `{"error":{"code":"usage_limit_reached",...}}` regardless of what the
// per-minute rate-limit headers say (confirmed live: 402 with
// x-ratelimit-remaining still at 28/30, i.e. request-rate was fine, the
// daily allowance was the actual constraint) — so `usageExhausted` below
// is tracked from that status code, not derived from `dailyRemaining`
// hitting zero, since the 402 response doesn't reliably carry that header
// at all. All three signals are tracked so routes/reporting can tell
// "about to get rate-limited," "running low on today's quota," and
// "already fully out of usage until the plan resets" apart from each
// other, and warn on the first two proactively rather than only ever
// reacting to the third after the fact.
export interface MarketauxQuotaStatus {
  requestRateLimit: number | null;
  requestRateRemaining: number | null;
  dailyLimit: number | null;
  dailyRemaining: number | null;
  usageExhausted: boolean;
  updatedAt: number | null;
}

let quotaStatus: MarketauxQuotaStatus = {
  requestRateLimit: null,
  requestRateRemaining: null,
  dailyLimit: null,
  dailyRemaining: null,
  usageExhausted: false,
  updatedAt: null,
};

const LOW_RATE_WARNING_THRESHOLD = 5;
const LOW_DAILY_WARNING_THRESHOLD = 10;

function recordMarketauxQuota(response: Response, usageExhausted: boolean): void {
  const rateLimitHeader = response.headers.get("x-ratelimit-limit");
  const rateRemainingHeader = response.headers.get("x-ratelimit-remaining");
  const dailyLimitHeader = response.headers.get("x-usagelimit-limit");
  const dailyRemainingHeader = response.headers.get("x-usagelimit-remaining");

  quotaStatus = {
    requestRateLimit: rateLimitHeader !== null ? Number(rateLimitHeader) : quotaStatus.requestRateLimit,
    requestRateRemaining: rateRemainingHeader !== null ? Number(rateRemainingHeader) : quotaStatus.requestRateRemaining,
    dailyLimit: dailyLimitHeader !== null ? Number(dailyLimitHeader) : quotaStatus.dailyLimit,
    dailyRemaining: dailyRemainingHeader !== null ? Number(dailyRemainingHeader) : quotaStatus.dailyRemaining,
    usageExhausted,
    updatedAt: Date.now(),
  };

  if (usageExhausted) {
    console.warn("[news] Marketaux account usage allowance is fully exhausted (HTTP 402 usage_limit_reached)");
    return;
  }

  if (quotaStatus.dailyRemaining !== null && quotaStatus.dailyRemaining <= LOW_DAILY_WARNING_THRESHOLD) {
    console.warn(
      `[news] Marketaux daily quota running low: ${quotaStatus.dailyRemaining}/${quotaStatus.dailyLimit ?? "?"} remaining today`
    );
  }
  if (quotaStatus.requestRateRemaining !== null && quotaStatus.requestRateRemaining <= LOW_RATE_WARNING_THRESHOLD) {
    console.warn(
      `[news] Marketaux request-rate limit running low: ${quotaStatus.requestRateRemaining}/${quotaStatus.requestRateLimit ?? "?"} remaining this window`
    );
  }
}

// Exposed for diagnostics/reporting — reflects whatever the most recent
// Marketaux response (from any consumer) reported, not a live probe.
export function getMarketauxQuotaStatus(): MarketauxQuotaStatus {
  return quotaStatus;
}

function classifyFailureReason(status: number): MarketauxFailureReason {
  // Live-confirmed against this account: a fully-exhausted usage allowance
  // answers every request with 402 Payment Required and body
  // `{"error":{"code":"usage_limit_reached"}}` — distinct from a 429
  // short-window rate limit, which clears again within seconds/minutes
  // rather than needing the plan's usage cap to reset.
  if (status === 402) return "quota_exceeded";
  if (status === 429) return "rate_limited";
  if (status === 401 || status === 403) return "unauthorized";
  if (status >= 500) return "server_error";
  return "unknown";
}

// Swallows any failure into `{ articles: [], ok: false, errorDetail }`
// (with server-side error logging) instead of throwing, so an upstream
// outage never crashes the calling route. `errorDetail` carries the real
// status/classified reason/body forward to the caller — a bare boolean
// `ok` can't distinguish "rate limited" from "bad API key" from "malformed
// query," and those need different fixes and different user-facing
// messages. Logs the request URL (credential redacted) and the response
// body on failure regardless.
export async function fetchAndCleanMarketaux(
  apiKey: string | undefined,
  params: Record<string, string>
): Promise<SourceResult> {
  if (!apiKey) {
    const message = "MARKETAUX_API_KEY not configured";
    console.error(`[news] ${message} — skipping Marketaux`);
    return { articles: [], ok: false, errorDetail: { reason: "not_configured", message } };
  }

  const url = buildMarketauxUrl(apiKey, params);

  try {
    const response = await fetch(url);

    if (!response.ok) {
      const reason = classifyFailureReason(response.status);
      recordMarketauxQuota(response, reason === "quota_exceeded");
      const bodyText = await response.text().catch(() => "<failed to read body>");
      console.error(
        `[news] Marketaux request failed — status ${response.status} ${response.statusText} (${reason})\n` +
          `  url: ${redactApiKey(url, "api_token")}\n` +
          `  body: ${bodyText}`
      );
      return {
        articles: [],
        ok: false,
        errorDetail: { reason, status: response.status, message: bodyText.slice(0, 500) },
      };
    }
    recordMarketauxQuota(response, false);
    const body = await response.json().catch(() => null);
    const raw = Array.isArray(body?.data) ? body.data : [];
    return { articles: cleanMarketauxArticles(raw), ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[news] Marketaux request threw: ${message}\n  url: ${redactApiKey(url, "api_token")}`);
    return { articles: [], ok: false, errorDetail: { reason: "network_error", message } };
  }
}

// Marketaux's free/lower tiers have the same kind of tight daily request
// cap TwelveData's sparkline endpoint does — this mirrors that route's
// own 25-minute TTL (lib/sparklineFetch.ts's SPARKLINE_CACHE_TTL_MS)
// rather than the much longer (2-4hr) TTLs the old dual-provider setup
// needed to survive splitting one quota budget two ways.
export const MARKETAUX_CACHE_TTL_MS = 25 * 60_000;

// The general News feed's grid (app/api/news/route.ts) is a special case:
// live-confirmed this account's plan caps every request at exactly 3
// articles regardless of the requested `limit` (see that route's own
// comment), so showing 15 articles on first load means fetching 5
// separate pages instead of 1 — a 5x jump in Marketaux calls per cache
// refresh versus every other feed sharing MARKETAUX_CACHE_TTL_MS above.
// A longer, dedicated TTL for just this feed keeps that cost sane against
// the shared 100-requests/day cap without slowing down the ticker/crypto/
// commodities feeds, which didn't get more expensive and don't need it.
export const GRID_CACHE_TTL_MS = 60 * 60_000;

// ---------------------------------------------------------------------
// Dedup
// ---------------------------------------------------------------------

// Lowercase, strip punctuation, collapse whitespace, and take the first 50
// characters — a cheap fingerprint for "is this the same story," e.g.
// when Marketaux's own index has picked up the same wire story from two
// syndicating outlets.
function titleFingerprint(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 50);
}

// Dedupes by exact URL or title fingerprint and sorts by publishedAt
// descending. Previously merged two providers' arrays together (filling
// in whichever fields one version was missing from the other); now that
// Marketaux is the only source there's nothing to merge from, so this is
// just the dedupe+sort pass applied to its one result list.
export function dedupeAndSortArticles(articles: NewsArticle[]): NewsArticle[] {
  const deduped: NewsArticle[] = [];
  const urlIndex = new Set<string>();
  const fingerprintIndex = new Set<string>();

  for (const article of articles) {
    const fingerprint = titleFingerprint(article.title);
    if (urlIndex.has(article.url) || fingerprintIndex.has(fingerprint)) continue;
    urlIndex.add(article.url);
    fingerprintIndex.add(fingerprint);
    deduped.push(article);
  }

  return deduped.sort((a, b) => {
    const aTime = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
    const bTime = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
    return bTime - aTime;
  });
}

// ---------------------------------------------------------------------
// Shared text-hygiene checks (provider-independent — not the keyword/
// topic-relevance filtering that used to compensate for NewsAPI's lack
// of entity awareness, just basic data-quality passes any single source
// can still need).
// ---------------------------------------------------------------------

export function containsAny(text: string, terms: string[]): boolean {
  return terms.some((term) => text.includes(term));
}

// Belt-and-suspenders on top of Marketaux's own `language: "en"` param —
// confirmed live (back when this ran against both providers) that non-
// English content still slipped through occasionally. Financial news
// titles/descriptions should be pure Latin script; any Japanese/Chinese/
// Korean/Arabic/Cyrillic characters are treated as a clear non-English
// signal.
const NON_LATIN_SCRIPT_PATTERN = /[぀-ヿ㐀-鿿가-힯؀-ۿЀ-ӿ]/;

export function isEnglishScript(article: NewsArticle): boolean {
  return !NON_LATIN_SCRIPT_PATTERN.test(`${article.title} ${article.description ?? ""}`);
}

// Word-overlap dedup, on top of dedupeAndSortArticles's own exact-URL/
// title-fingerprint dedup — confirmed live that two outlets covering the
// same story can differ enough in their first 50 characters to slip past
// that prefix-based check while still being clearly the same story.
//
// Uses the overlap coefficient (intersection / smaller set) rather than
// Jaccard (intersection / union): headlines are short enough that a
// couple of differing filler words drag a union-based ratio down a lot
// even when the words that actually identify the story match perfectly.
const OVERLAP_DEDUP_THRESHOLD = 0.5;

function titleWordSet(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .replace(/'s\b/g, "")
      .replace(/[^\w\s]/g, "")
      .split(/\s+/)
      .filter((word) => word.length > 2)
  );
}

function overlapCoefficient(a: Set<string>, b: Set<string>): number {
  const intersectionSize = [...a].filter((word) => b.has(word)).length;
  const smaller = Math.min(a.size, b.size);
  return smaller === 0 ? 0 : intersectionSize / smaller;
}

export function dedupeSimilarTitles(articles: NewsArticle[]): NewsArticle[] {
  const kept: NewsArticle[] = [];
  const keptWordSets: Set<string>[] = [];

  for (const article of articles) {
    const words = titleWordSet(article.title);
    const isDuplicate = keptWordSets.some(
      (existing) => overlapCoefficient(existing, words) >= OVERLAP_DEDUP_THRESHOLD
    );
    if (!isDuplicate) {
      kept.push(article);
      keptWordSets.push(words);
    }
  }

  return kept;
}
