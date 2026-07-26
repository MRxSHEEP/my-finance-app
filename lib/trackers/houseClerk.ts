import { throttledHouseClerkCall } from "@/lib/trackers/houseClerkThrottle";
import { parsePtrPdf } from "@/lib/trackers/ptrPdfParser";
import { persistCongressFiling, findAlreadyParsedFilingIds } from "@/lib/trackers/congressFilingIngest";

// A descriptive User-Agent identifying this app + a contact point — the
// House Clerk site publishes no fair-access policy the way SEC EDGAR does
// (no robots.txt either, confirmed live), but this is the same politeness
// convention already used for lib/trackers/secEdgar.ts.
const USER_AGENT = "Noble Finance App tracker-ingestion (contact: noble-app@example.com)";
const BASE_URL = "https://disclosures-clerk.house.gov";

export interface HouseFilingRef {
  filingId: string;
  filerName: string; // normalized "First Last" — see normalizeHouseName
  office: string; // e.g. "MO04", or "Former Member (FL20)"
  filingYear: string;
  pdfUrl: string;
}

// The search results table prints names as "Lastname, Hon.. Firstname
// Suffix." (confirmed live) — reformatted into a plain "Firstname Lastname"
// so it slugifies/displays the same way the FMP-sourced congress entities
// (lib/trackers/congress.ts) already do, rather than introducing a second,
// visually inconsistent naming convention for the same kind of entity.
export function normalizeHouseName(raw: string): string {
  const [last, rest] = raw.split(",").map((s) => s.trim());
  if (!rest) return raw.trim().replace(/\s+/g, " ");
  const first = rest.replace(/^Hon\.+\s*/i, "").trim();
  return `${first} ${last}`.replace(/\s+/g, " ").trim();
}

// Only "PTR Original"/"PTR Amendment" rows link to an actual Periodic
// Transaction Report — confirmed live that "Extension"/"New Filer"/
// "Termination" rows link to a *different* PDF path
// (public_disc/financial-pdfs/, the annual-disclosure form family) that
// this pipeline has no business parsing as a transaction table.
function parseSearchResultsHtml(html: string): HouseFilingRef[] {
  const rows = html.match(/<tr role="row">[\s\S]*?<\/tr>/g) ?? [];
  const refs: HouseFilingRef[] = [];

  for (const row of rows) {
    const filingType = row.match(/data-label="Filing">([^<]*)</)?.[1]?.trim() ?? "";
    if (!/PTR/i.test(filingType)) continue;

    const hrefMatch = row.match(/href="([^"]*ptr-pdfs[^"]*)"/);
    const nameMatch = row.match(/class="memberName">\s*<a[^>]*>([^<]*)<\/a>/);
    const officeMatch = row.match(/data-label="Office">([^<]*)</);
    const yearMatch = row.match(/data-label="Filing Year">([^<]*)</);
    if (!hrefMatch || !nameMatch) continue;

    const filingId = hrefMatch[1].match(/(\d+)\.pdf$/)?.[1];
    if (!filingId) continue;

    refs.push({
      filingId,
      filerName: normalizeHouseName(nameMatch[1]),
      office: officeMatch?.[1]?.trim() ?? "",
      filingYear: yearMatch?.[1]?.trim() ?? "",
      pdfUrl: `${BASE_URL}/${hrefMatch[1]}`,
    });
  }

  return refs;
}

// Confirmed live: a single POST with a blank LastName + a specific
// FilingYear returns EVERY member's filing for that year in one response
// (317 rows for 2026, no server-side pagination) — this is what makes
// "check for new filings since last run" a single cheap request rather
// than a per-politician search. Also confirmed live: this endpoint accepts
// the request with no CSRF token and no session cookie at all (the
// hidden __RequestVerificationToken field present in the real search form
// is not actually enforced server-side for this read-only search), so
// there's no session/token plumbing needed here at all.
export async function searchHouseFilingsForYear(year: number): Promise<HouseFilingRef[]> {
  return throttledHouseClerkCall(async () => {
    try {
      const body = new URLSearchParams({ LastName: "", FilingYear: String(year), State: "", District: "" });
      const response = await fetch(`${BASE_URL}/FinancialDisclosure/ViewMemberSearchResult`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": USER_AGENT },
        body: body.toString(),
      });
      if (!response.ok) {
        console.error(`[house-clerk] search for ${year} failed — status ${response.status}`);
        return [];
      }
      return parseSearchResultsHtml(await response.text());
    } catch (err) {
      console.error(`[house-clerk] search for ${year} threw: ${err instanceof Error ? err.message : String(err)}`);
      return [];
    }
  });
}

async function fetchHousePtrPdf(pdfUrl: string): Promise<Uint8Array | null> {
  return throttledHouseClerkCall(async () => {
    try {
      const response = await fetch(pdfUrl, { headers: { "User-Agent": USER_AGENT } });
      if (!response.ok) {
        console.error(`[house-clerk] pdf fetch ${pdfUrl} failed — status ${response.status}`);
        return null;
      }
      return new Uint8Array(await response.arrayBuffer());
    } catch (err) {
      console.error(`[house-clerk] pdf fetch ${pdfUrl} threw: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
  });
}

export interface HouseIngestResult {
  filingsSeen: number;
  filingsAlreadyCached: number;
  filingsParsed: number;
  filingsFailed: number;
  filingsNeedingReview: number;
  transactionsCreated: number;
}

// Checks the current year AND the previous one every run — cheap (one
// extra POST) and guards against a filing made in late December landing
// just after a year boundary between runs.
export async function ingestHousePtrFilings(): Promise<HouseIngestResult> {
  const now = new Date();
  const years = [now.getUTCFullYear(), now.getUTCFullYear() - 1];

  const allRefs: HouseFilingRef[] = [];
  for (const year of years) {
    allRefs.push(...(await searchHouseFilingsForYear(year)));
  }

  const alreadyCached = await findAlreadyParsedFilingIds(
    "house",
    allRefs.map((r) => r.filingId)
  );
  const newRefs = allRefs.filter((r) => !alreadyCached.has(r.filingId));

  let filingsParsed = 0;
  let filingsFailed = 0;
  let filingsNeedingReview = 0;
  let transactionsCreated = 0;

  for (const ref of newRefs) {
    const pdfBytes = await fetchHousePtrPdf(ref.pdfUrl);
    if (!pdfBytes) {
      filingsFailed++;
      continue;
    }

    try {
      const parsed = await parsePtrPdf(pdfBytes);
      const filerName = parsed.filerName ?? ref.filerName;
      const office = ref.office.replace(/\s+/g, " ").trim();
      const chamberTitle = office.startsWith("Former Member") ? `U.S. Representative — ${office}` : `U.S. Representative (${office})`;

      const result = await persistCongressFiling({
        chamber: "house",
        filingId: ref.filingId,
        sourceUrl: ref.pdfUrl,
        filerName,
        chamberTitle,
        disclosureDate: parsed.transactions[0]?.notificationDate ?? null,
        sourceType: "congress_house_pdf",
        transactions: parsed.transactions.map((tx) => ({
          ticker: tx.ticker,
          assetDescription: tx.assetDescription,
          transactionType: tx.transactionType,
          transactionDate: tx.transactionDate,
          amountLow: tx.amountRangeLow,
          amountHigh: tx.amountRangeHigh,
        })),
        usedOcr: parsed.usedOcr,
        unparsed: parsed.unparsed,
      });

      filingsParsed++;
      if (result.needsReview) filingsNeedingReview++;
      transactionsCreated += result.transactionsCreated;
    } catch (err) {
      console.error(`[house-clerk] parsing ${ref.pdfUrl} threw: ${err instanceof Error ? err.message : String(err)}`);
      filingsFailed++;
    }
  }

  return {
    filingsSeen: allRefs.length,
    filingsAlreadyCached: alreadyCached.size,
    filingsParsed,
    filingsFailed,
    filingsNeedingReview,
    transactionsCreated,
  };
}
