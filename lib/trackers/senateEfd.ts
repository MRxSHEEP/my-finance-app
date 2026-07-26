import { throttledSenateEfdCall } from "@/lib/trackers/senateEfdThrottle";
import { persistCongressFiling, findAlreadyParsedFilingIds } from "@/lib/trackers/congressFilingIngest";
import type { UnparsedBlock } from "@/lib/trackers/ptrPdfParser";

const USER_AGENT = "Noble Finance App tracker-ingestion (contact: noble-app@example.com)";
const BASE_URL = "https://efdsearch.senate.gov";

// efdsearch.senate.gov gates its search behind a click-through agreement
// (the same 5 U.S.C. app. § 105(c) text as the House Clerk — see
// lib/trackers/congressPdfGate.ts) implemented as: GET /search/ redirects
// to /search/home/ and renders the agreement checkbox; POSTing
// prohibition_agreement=1 + a valid Django CSRF token sets a `sessionid`
// cookie recording that the agreement was accepted; every subsequent
// request in that session (same cookie jar) then sees the real search UI
// instead of the gate. Confirmed live end-to-end.
interface CookieJar {
  cookies: Map<string, string>;
}

function newJar(): CookieJar {
  return { cookies: new Map() };
}

function applySetCookie(jar: CookieJar, response: Response): void {
  // Node's fetch exposes multiple Set-Cookie headers via getSetCookie();
  // each one is "name=value; attr=...", only the first "name=value" pair matters here.
  const setCookies = typeof response.headers.getSetCookie === "function" ? response.headers.getSetCookie() : [];
  for (const raw of setCookies) {
    const [pair] = raw.split(";");
    const eq = pair.indexOf("=");
    if (eq === -1) continue;
    jar.cookies.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
  }
}

function cookieHeader(jar: CookieJar): string {
  return Array.from(jar.cookies.entries())
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

function extractCsrfToken(html: string): string | null {
  return html.match(/csrfmiddlewaretoken"\s*value="([^"]*)"/)?.[1] ?? null;
}

export interface SenateSession {
  jar: CookieJar;
  csrfToken: string;
}

// Establishes a fresh agreed session: 3 requests total (GET agreement page,
// POST the agreement, GET the now-unlocked search page for a token valid
// against this session) — deliberately not cached/reused across ingestion
// runs, since a new run is at most once a day and re-establishing a session
// from scratch each time is simpler and more robust than trying to persist
// Django session state between serverless invocations.
export async function establishSenateSession(): Promise<SenateSession | null> {
  return throttledSenateEfdCall(async () => {
    try {
      const jar = newJar();

      const agreementPage = await fetch(`${BASE_URL}/search/`, {
        headers: { "User-Agent": USER_AGENT },
        redirect: "follow",
      });
      applySetCookie(jar, agreementPage);
      const agreementHtml = await agreementPage.text();
      const agreementToken = extractCsrfToken(agreementHtml);
      if (!agreementToken) {
        console.error("[senate-efd] could not find a CSRF token on the agreement page");
        return null;
      }

      const agreementPost = await fetch(`${BASE_URL}/search/home/`, {
        method: "POST",
        headers: {
          "User-Agent": USER_AGENT,
          "Content-Type": "application/x-www-form-urlencoded",
          Referer: `${BASE_URL}/search/home/`,
          Cookie: cookieHeader(jar),
        },
        body: new URLSearchParams({ prohibition_agreement: "1", csrfmiddlewaretoken: agreementToken }).toString(),
        redirect: "manual",
      });
      applySetCookie(jar, agreementPost);
      if (agreementPost.status !== 302) {
        console.error(`[senate-efd] agreement POST returned unexpected status ${agreementPost.status}`);
        return null;
      }

      const realSearchPage = await fetch(`${BASE_URL}/search/`, {
        headers: { "User-Agent": USER_AGENT, Cookie: cookieHeader(jar) },
      });
      applySetCookie(jar, realSearchPage);
      const realSearchHtml = await realSearchPage.text();
      const searchToken = extractCsrfToken(realSearchHtml);
      if (!searchToken || realSearchHtml.includes("prohibition_agreement")) {
        console.error("[senate-efd] session did not unlock the real search form as expected");
        return null;
      }

      return { jar, csrfToken: searchToken };
    } catch (err) {
      console.error(`[senate-efd] establishing session threw: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
  });
}

export interface SenatePtrFilingRef {
  filingId: string; // the UUID from /search/view/ptr/{uuid}/
  firstName: string;
  lastName: string;
  filerDisplay: string; // e.g. "Tuberville, Tommy (Senator)"
  reportUrl: string;
  filedDate: string; // MM/DD/YYYY
}

const REPORT_TYPE_PTR = "11";
const SEARCH_PAGE_LENGTH = 100;
const MAX_SEARCH_PAGES = 20; // safety valve — 20 * 100 = 2000 rows/run cap

// The site's own DataTable only ever sends its *unfiltered-default* AJAX
// payload from the static page load (`d.report_types = "[]"` etc., visible
// in the page's own inline script) — a real user's filtered search is a
// full-page form POST that server-renders a NEW page with those defaults
// swapped for the submitted filter, which is what actually drives the
// DataTable after that. Reverse-engineered the equivalent single request
// live: POSTing directly to /search/report/data/ with `report_types`
// (plural!) as a JSON-array-shaped string works and returns real filtered
// rows — confirmed against a real Tommy Tuberville PTR row live. Also
// confirmed live: this same endpoint intermittently returns a 503 "Site
// Under Maintenance" page seconds after a successful 200 with no request
// pattern change — treated as a transient, expected outcome (return null,
// don't retry within the same run) rather than a bug, per the explicit
// instruction not to hammer a site that might be rate-limiting/challenging
// automated traffic.
async function fetchSearchPage(
  session: SenateSession,
  sinceDate: Date,
  start: number
): Promise<{ rows: unknown[][]; recordsTotal: number } | null> {
  return throttledSenateEfdCall(async () => {
    try {
      const submittedStart = `${String(sinceDate.getUTCMonth() + 1).padStart(2, "0")}/${String(sinceDate.getUTCDate()).padStart(2, "0")}/${sinceDate.getUTCFullYear()} 00:00:00`;

      const body = new URLSearchParams({
        first_name: "",
        last_name: "",
        filer_types: "[]",
        report_types: `["${REPORT_TYPE_PTR}"]`,
        submitted_start_date: submittedStart,
        submitted_end_date: "",
        candidate_state: "",
        senator_state: "",
        office_id: "",
        csrfmiddlewaretoken: session.csrfToken,
        draw: "1",
        start: String(start),
        length: String(SEARCH_PAGE_LENGTH),
      });

      const response = await fetch(`${BASE_URL}/search/report/data/`, {
        method: "POST",
        headers: {
          "User-Agent": USER_AGENT,
          "Content-Type": "application/x-www-form-urlencoded",
          "X-Requested-With": "XMLHttpRequest",
          Referer: `${BASE_URL}/search/`,
          Cookie: cookieHeader(session.jar),
        },
        body: body.toString(),
      });

      if (!response.ok) {
        console.error(`[senate-efd] search/report/data returned status ${response.status} — treating as temporarily unavailable`);
        return null;
      }

      const json = (await response.json().catch(() => null)) as { data?: unknown[][]; recordsTotal?: number } | null;
      if (!json || !Array.isArray(json.data)) return null;
      return { rows: json.data, recordsTotal: json.recordsTotal ?? json.data.length };
    } catch (err) {
      console.error(`[senate-efd] search/report/data threw: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
  });
}

export async function searchSenatePtrFilings(session: SenateSession, sinceDate: Date): Promise<SenatePtrFilingRef[] | null> {
  const refs: SenatePtrFilingRef[] = [];
  let start = 0;

  for (let page = 0; page < MAX_SEARCH_PAGES; page++) {
    const result = await fetchSearchPage(session, sinceDate, start);
    if (!result) return refs.length > 0 ? refs : null;

    for (const row of result.rows) {
      const [firstName, lastName, filerDisplay, anchorHtml, filedDate] = row as string[];
      const hrefMatch = anchorHtml?.match(/href="([^"]*\/ptr\/[^"]*)"/);
      if (!hrefMatch) continue; // defensive — report_types isn't always honored, per the comment above

      const filingId = hrefMatch[1].match(/\/ptr\/([^/]+)\//)?.[1];
      if (!filingId) continue;

      refs.push({
        filingId,
        firstName: firstName ?? "",
        lastName: lastName ?? "",
        filerDisplay: filerDisplay ?? "",
        reportUrl: `${BASE_URL}${hrefMatch[1]}`,
        filedDate: filedDate ?? "",
      });
    }

    start += SEARCH_PAGE_LENGTH;
    if (start >= result.recordsTotal) break;
  }

  return refs;
}

export interface ParsedSenateTransaction {
  owner: string;
  ticker: string | null;
  assetName: string;
  transactionType: string;
  transactionDate: string | null;
  amountRangeLow: number | null;
  amountRangeHigh: number | null;
}

function stripTags(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&#35;/g, "#")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function classifySenateTxType(raw: string): string {
  const lower = raw.toLowerCase();
  if (lower.includes("purchase")) return "buy";
  if (lower.includes("partial")) return "partial_sell";
  if (lower.includes("sale")) return "sell";
  if (lower.includes("exchange")) return "exchange";
  return "other";
}

function parseAmountRangeText(raw: string): { low: number | null; high: number | null } {
  const numbers = raw.match(/[\d,]+/g)?.map((n) => Number(n.replace(/,/g, ""))) ?? [];
  if (numbers.length >= 2) return { low: numbers[0], high: numbers[1] };
  if (numbers.length === 1) return { low: numbers[0], high: null };
  return { low: null, high: null };
}

// Senate PTR filings (at least everything from ~2012 onward, per the
// search UI's own datepicker minDate) render as a plain server-rendered
// HTML table directly on the filing's own page — confirmed live against a
// real Tommy Tuberville filing (11 transactions, WAB/Westinghouse Air Brake
// among them). This is a genuinely different, and more reliable, situation
// than the House side: no PDF, no OCR fallback needed at all for the
// Senate pipeline in the modern/going-forward case this daily job cares
// about.
export function parseSenatePtrHtml(html: string): {
  transactions: ParsedSenateTransaction[];
  unparsed: UnparsedBlock[];
} {
  const tableMatch = html.match(/<table class="table table-striped">[\s\S]*?<\/table>/);
  if (!tableMatch) {
    return { transactions: [], unparsed: [{ line: "(whole document)", reason: "no transactions table found on the filing page — may be a non-electronic/paper filing rendered differently" }] };
  }

  const rowMatches = tableMatch[0].match(/<tr>[\s\S]*?<\/tr>/g) ?? [];
  const transactions: ParsedSenateTransaction[] = [];
  const unparsed: UnparsedBlock[] = [];

  for (const row of rowMatches) {
    const cells = row.match(/<td[^>]*>([\s\S]*?)<\/td>/g)?.map((cell) => stripTags(cell)) ?? [];
    if (cells.length < 8) {
      unparsed.push({ line: row.slice(0, 200), reason: `expected at least 8 cells, found ${cells.length}` });
      continue;
    }

    const [, transactionDateRaw, owner, ticker, assetName, , typeRaw, amountRaw] = cells;
    const { low, high } = parseAmountRangeText(amountRaw);

    transactions.push({
      owner: owner || "Self",
      ticker: ticker && ticker !== "--" ? ticker : null,
      assetName: assetName || "",
      transactionType: classifySenateTxType(typeRaw ?? ""),
      transactionDate: transactionDateRaw || null,
      amountRangeLow: low,
      amountRangeHigh: high,
    });
  }

  return { transactions, unparsed };
}

async function fetchSenatePtrPage(session: SenateSession, url: string): Promise<string | null> {
  return throttledSenateEfdCall(async () => {
    try {
      const response = await fetch(url, { headers: { "User-Agent": USER_AGENT, Cookie: cookieHeader(session.jar) } });
      if (!response.ok) {
        console.error(`[senate-efd] filing page ${url} failed — status ${response.status}`);
        return null;
      }
      return await response.text();
    } catch (err) {
      console.error(`[senate-efd] filing page ${url} threw: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
  });
}

export interface SenateIngestResult {
  sessionEstablished: boolean;
  searchAvailable: boolean;
  filingsSeen: number;
  filingsAlreadyCached: number;
  filingsParsed: number;
  filingsFailed: number;
  filingsNeedingReview: number;
  transactionsCreated: number;
}

const LOOKBACK_DAYS = 30;

export async function ingestSenatePtrFilings(): Promise<SenateIngestResult> {
  const session = await establishSenateSession();
  if (!session) {
    return {
      sessionEstablished: false,
      searchAvailable: false,
      filingsSeen: 0,
      filingsAlreadyCached: 0,
      filingsParsed: 0,
      filingsFailed: 0,
      filingsNeedingReview: 0,
      transactionsCreated: 0,
    };
  }

  const sinceDate = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
  const refs = await searchSenatePtrFilings(session, sinceDate);
  if (refs === null) {
    return {
      sessionEstablished: true,
      searchAvailable: false,
      filingsSeen: 0,
      filingsAlreadyCached: 0,
      filingsParsed: 0,
      filingsFailed: 0,
      filingsNeedingReview: 0,
      transactionsCreated: 0,
    };
  }

  const alreadyCached = await findAlreadyParsedFilingIds(
    "senate",
    refs.map((r) => r.filingId)
  );
  const newRefs = refs.filter((r) => !alreadyCached.has(r.filingId));

  let filingsParsed = 0;
  let filingsFailed = 0;
  let filingsNeedingReview = 0;
  let transactionsCreated = 0;

  for (const ref of newRefs) {
    const html = await fetchSenatePtrPage(session, ref.reportUrl);
    if (!html) {
      filingsFailed++;
      continue;
    }

    try {
      const { transactions, unparsed } = parseSenatePtrHtml(html);
      const filerName = `${ref.firstName} ${ref.lastName}`.replace(/\s+/g, " ").trim();
      const stateMatch = ref.filerDisplay.match(/\(([^)]*)\)/);
      const chamberTitle = stateMatch ? `U.S. Senator (${stateMatch[1]})` : "U.S. Senator";

      const result = await persistCongressFiling({
        chamber: "senate",
        filingId: ref.filingId,
        sourceUrl: ref.reportUrl,
        filerName,
        chamberTitle,
        disclosureDate: ref.filedDate || null,
        sourceType: "congress_senate_pdf",
        transactions: transactions.map((tx) => ({
          ticker: tx.ticker,
          assetDescription: tx.assetName,
          transactionType: tx.transactionType,
          transactionDate: tx.transactionDate,
          amountLow: tx.amountRangeLow,
          amountHigh: tx.amountRangeHigh,
        })),
        usedOcr: false,
        unparsed,
      });

      filingsParsed++;
      if (result.needsReview) filingsNeedingReview++;
      transactionsCreated += result.transactionsCreated;
    } catch (err) {
      console.error(`[senate-efd] parsing ${ref.reportUrl} threw: ${err instanceof Error ? err.message : String(err)}`);
      filingsFailed++;
    }
  }

  return {
    sessionEstablished: true,
    searchAvailable: true,
    filingsSeen: refs.length,
    filingsAlreadyCached: alreadyCached.size,
    filingsParsed,
    filingsFailed,
    filingsNeedingReview,
    transactionsCreated,
  };
}
