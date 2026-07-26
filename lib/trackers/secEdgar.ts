import { throttledEdgarCall } from "@/lib/trackers/edgarThrottle";

// SEC EDGAR requires a descriptive User-Agent identifying the requester
// (their fair-access policy — no API key, but an unidentified/generic
// User-Agent risks a 403) and asks for a reasonable request rate — every
// call in this module goes through throttledEdgarCall (lib/trackers/edgarThrottle.ts)
// to stay under that rate regardless of how many filings a given
// ingestion run needs to walk through.
const USER_AGENT = "Noble Finance App tracker-ingestion (contact: noble-app@example.com)";

async function fetchJson<T>(url: string): Promise<T | null> {
  return throttledEdgarCall(async () => {
    try {
      const response = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
      if (!response.ok) {
        console.error(`[sec-edgar] ${url} failed — status ${response.status}`);
        return null;
      }
      return (await response.json().catch(() => null)) as T | null;
    } catch (err) {
      console.error(`[sec-edgar] ${url} threw: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
  });
}

async function fetchText(url: string): Promise<string | null> {
  return throttledEdgarCall(async () => {
    try {
      const response = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
      if (!response.ok) {
        console.error(`[sec-edgar] ${url} failed — status ${response.status}`);
        return null;
      }
      return await response.text();
    } catch (err) {
      console.error(`[sec-edgar] ${url} threw: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
  });
}

interface SubmissionsResponse {
  name: string;
  filings: {
    recent: {
      form: string[];
      filingDate: string[];
      accessionNumber: string[];
    };
  };
}

export interface Latest13F {
  accessionNumber: string;
  filingDate: string;
}

async function fetchRecentFilingList(cik: string): Promise<Latest13F[]> {
  const paddedCik = cik.padStart(10, "0");
  const body = await fetchJson<SubmissionsResponse>(`https://data.sec.gov/submissions/CIK${paddedCik}.json`);
  if (!body) return [];

  const { form, filingDate, accessionNumber } = body.filings.recent;
  const filings: Latest13F[] = [];
  for (let i = 0; i < form.length; i++) {
    if (form[i] === "13F-HR") filings.push({ accessionNumber: accessionNumber[i], filingDate: filingDate[i] });
  }
  return filings;
}

export async function fetchLatest13F(cik: string): Promise<Latest13F | null> {
  const filings = await fetchRecentFilingList(cik);
  return filings[0] ?? null;
}

// Up to the last `count` 13F-HR filings (most recent first) — used only
// for the performance-history backfill (lib/trackers/thirteenF.ts), which
// needs several quarters of total portfolio value to chain a real return
// series. EDGAR's submissions endpoint already returns full filing
// history in one call, so this doesn't cost anything extra over
// fetchLatest13F beyond slicing more of the same response.
export async function fetchRecent13Fs(cik: string, count: number): Promise<Latest13F[]> {
  const filings = await fetchRecentFilingList(cik);
  return filings.slice(0, count);
}

interface FilingIndexResponse {
  directory: { item: Array<{ name: string; size: string }> };
}

// The information table (actual holdings) is always a distinct XML file
// in the filing's directory alongside primary_doc.xml (the cover page),
// named after its own internal document sequence number rather than any
// fixed filename — confirmed live across the 7 seeded funds' filings that
// name varies (e.g. Berkshire's is "53405.xml", Bridgewater's is
// "infotable.xml"). Picking the LARGEST .xml file in the directory is a
// far more reliable signal than excluding "primary_doc.xml" by name alone
// (which breaks if a filer's cover-page document happens to use a
// different filename) — the cover page is always a few KB, the actual
// holdings table is tens of KB to low MBs for any real fund.
async function findInformationTableFilename(cik: string, accessionNoDashes: string): Promise<string | null> {
  const body = await fetchJson<FilingIndexResponse>(
    `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${accessionNoDashes}/index.json`
  );
  if (!body) return null;

  const xmlFiles = body.directory.item.filter((item) => item.name.endsWith(".xml"));
  const largest = xmlFiles.sort((a, b) => Number(b.size) - Number(a.size))[0];
  return largest?.name ?? null;
}

export interface Raw13FPosition {
  nameOfIssuer: string;
  cusip: string;
  // Actual USD, not thousands — the commonly-cited "13F values are
  // reported in thousands" convention turned out NOT to apply to this
  // structured XML information table (only to the older paper/plain-text
  // filing format). Confirmed live: Berkshire's own reported Apple
  // position (692,000 sh, value 175,622,680) implies ~$253.79/share,
  // matching Apple's real share price around that filing's quarter-end —
  // multiplying by 1,000 would imply a ~$253,790/share price, which is
  // obviously wrong.
  value: number;
  shares: number;
}

function extractTag(block: string, tag: string): string | null {
  // Some filers' XML declares an explicit namespace prefix on every tag
  // (`<ns1:nameOfIssuer>`), others use a default namespace and no prefix
  // at all (`<nameOfIssuer>`) — confirmed live: Berkshire's filing uses no
  // prefix, Bridgewater's uses `ns1:` throughout. `(?:\w+:)?` tolerates
  // either without needing to know which one a given filing uses upfront.
  const fieldMatch = block.match(new RegExp(`<(?:\\w+:)?${tag}>([\\s\\S]*?)</(?:\\w+:)?${tag}>`, "i"));
  if (!fieldMatch) return null;
  const inner = fieldMatch[1];

  // Confirmed live: Form 4's schema (unlike 13F's flatter one) wraps many
  // fields in a nested <value> element — e.g.
  // <transactionDate><value>2026-06-15</value></transactionDate> — so an
  // alternate <footnoteId/> can stand in for it when the filer has
  // nothing to report but a footnote reference (transactionPricePerShare
  // on an RSU vesting, for instance). A naive "direct text content"
  // extraction matches only the whitespace before that nested tag and
  // silently returns empty — check for the nested <value> first.
  const nestedValueMatch = inner.match(/<(?:\w+:)?value>([^<]*)<\/(?:\w+:)?value>/i);
  if (nestedValueMatch) return nestedValueMatch[1].trim();

  // No nested <value> — either a genuinely flat tag (13F's own fields,
  // and Form 4's transactionCode/transactionAcquiredDisposedCode-style
  // enums), or a field standing in with only a footnote and no value at
  // all, which correctly falls through to null below rather than
  // returning stray whitespace/tag remnants.
  const directText = inner.replace(/<[^>]*>/g, "").trim();
  return directText || null;
}

// A lightweight regex parser rather than a new XML-library dependency —
// the informationTable schema is flat and stable (no nested repeating
// structures beyond the one <infoTable> block level), well-suited to this.
function parseInformationTable(xml: string): Raw13FPosition[] {
  const blocks = xml.match(/<(?:\w+:)?infoTable>[\s\S]*?<\/(?:\w+:)?infoTable>/gi) ?? [];
  const positions: Raw13FPosition[] = [];

  for (const block of blocks) {
    const nameOfIssuer = extractTag(block, "nameOfIssuer");
    const cusip = extractTag(block, "cusip");
    const value = Number(extractTag(block, "value") ?? "0");
    const shares = Number(extractTag(block, "sshPrnamt") ?? "0");

    if (nameOfIssuer && cusip) {
      positions.push({ nameOfIssuer, cusip, value, shares });
    }
  }

  return positions;
}

export async function fetchInformationTable(cik: string, accessionNumber: string): Promise<Raw13FPosition[]> {
  const accessionNoDashes = accessionNumber.replace(/-/g, "");
  const filename = await findInformationTableFilename(cik, accessionNoDashes);
  if (!filename) return [];

  const xml = await fetchText(
    `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${accessionNoDashes}/${filename}`
  );
  if (!xml) return [];

  return parseInformationTable(xml);
}

// --- Form 4 (insider transactions) ---
// Form 4s are filed under the individual INSIDER's own CIK, not the
// issuer company's — data.sec.gov/submissions/CIK{company}.json (the 13F
// approach above) only lists filings a company made about ITSELF (10-K,
// 8-K, etc.), never Form 4s filed by its insiders.
//
// The classic browse-edgar CGI endpoint (`action=getcompany&type=4`) was
// tried first and confirmed LIVE to be unreliable for this: its `type=`
// parameter is a prefix match, not an exact one — for a single-digit form
// type like "4" that also matches "424B2", "424B5", "4/A", "40-F", etc.
// For a company like JPMorgan that files many 424B2 prospectuses, a
// count=100 request came back 100% 424B2 with zero real Form 4s mixed in.
// SEC's full-text search endpoint (efts.sec.gov, the one backing
// https://www.sec.gov/cgi-bin/srqsb / the modern EDGAR full-text search
// UI) takes `forms=4` as a real exact-match filter instead, confirmed
// live against JPMorgan (CIK 19617): 1,341 genuine Form 4 hits, sorted
// newest-first. It also returns the filing's exact primary-document
// filename directly in each hit's `_id` ("{accession}:{filename}"),
// which removes the extra index.json lookup fetchInformationTable above
// needs for 13F — one fewer EDGAR request per filing.
export interface Form4FilingRef {
  accessionNumber: string;
  filingDate: string;
  documentUrl: string;
  indexUrl: string;
}

interface FullTextSearchResponse {
  hits: {
    hits: Array<{ _id: string; _source: { file_date: string } }>;
  };
}

export async function fetchCompanyForm4Filings(issuerCik: string, count: number): Promise<Form4FilingRef[]> {
  const paddedCik = issuerCik.padStart(10, "0");
  const url = `https://efts.sec.gov/LATEST/search-index?q=&forms=4&ciks=${paddedCik}`;
  const body = await fetchJson<FullTextSearchResponse>(url);
  if (!body) return [];

  const issuerCikNumeric = Number(issuerCik);
  return body.hits.hits.slice(0, count).map((hit) => {
    const [accessionNumber, filename] = hit._id.split(":");
    const accessionNoDashes = accessionNumber.replace(/-/g, "");
    return {
      accessionNumber,
      filingDate: hit._source.file_date,
      documentUrl: `https://www.sec.gov/Archives/edgar/data/${issuerCikNumeric}/${accessionNoDashes}/${filename}`,
      indexUrl: `https://www.sec.gov/Archives/edgar/data/${issuerCikNumeric}/${accessionNoDashes}/${accessionNumber}-index.html`,
    };
  });
}

export interface RawForm4Transaction {
  issuerTicker: string | null;
  issuerName: string | null;
  reportingOwnerName: string | null;
  reportingOwnerRole: string | null;
  transactionDate: string | null;
  transactionCode: string | null;
  shares: number | null;
  pricePerShare: number | null;
  acquiredOrDisposed: string | null;
  isDerivative: boolean;
}

function parseForm4Role(xml: string): string | null {
  const roles: string[] = [];
  if (/<isDirector>\s*true\s*<\/isDirector>/i.test(xml)) roles.push("Director");
  if (/<isTenPercentOwner>\s*true\s*<\/isTenPercentOwner>/i.test(xml)) roles.push("10% Owner");
  if (/<isOfficer>\s*true\s*<\/isOfficer>/i.test(xml)) {
    const title = extractTag(xml, "officerTitle");
    roles.push(title || "Officer");
  }
  if (/<isOther>\s*true\s*<\/isOther>/i.test(xml)) roles.push("Other");
  return roles.length > 0 ? roles.join(", ") : null;
}

function parseForm4TransactionBlocks(xml: string, tableTag: string, isDerivative: boolean): RawForm4Transaction[] {
  const tableMatch = xml.match(new RegExp(`<${tableTag}>[\\s\\S]*?</${tableTag}>`, "i"));
  if (!tableMatch) return [];

  const transactionTag = isDerivative ? "derivativeTransaction" : "nonDerivativeTransaction";
  const blocks = tableMatch[0].match(new RegExp(`<${transactionTag}>[\\s\\S]*?</${transactionTag}>`, "gi")) ?? [];

  return blocks.map((block) => {
    // transactionPricePerShare is sometimes a bare <footnoteId/> instead
    // of a <value> (e.g. RSU vesting with no per-share price to report) —
    // extractTag's simple tag-content match correctly returns null there
    // rather than mistaking a footnote reference for a real $0 price.
    const priceStr = extractTag(block, "transactionPricePerShare");
    return {
      issuerTicker: null, // filled in by the caller from the filing-level issuer block
      issuerName: null,
      reportingOwnerName: null,
      reportingOwnerRole: null,
      transactionDate: extractTag(block, "transactionDate"),
      transactionCode: extractTag(block, "transactionCode"),
      shares: (() => {
        const v = extractTag(block, "transactionShares");
        return v ? Number(v) : null;
      })(),
      pricePerShare: priceStr ? Number(priceStr) : null,
      acquiredOrDisposed: extractTag(block, "transactionAcquiredDisposedCode"),
      isDerivative,
    };
  });
}

// A lightweight regex parser, same reasoning as parseInformationTable
// above — Form 4's ownershipDocument schema is a flat, stable structure.
export function parseForm4Xml(xml: string): RawForm4Transaction[] {
  const issuerBlock = xml.match(/<issuer>[\s\S]*?<\/issuer>/i)?.[0] ?? "";
  const issuerTicker = extractTag(issuerBlock, "issuerTradingSymbol");
  const issuerName = extractTag(issuerBlock, "issuerName");

  const ownerBlock = xml.match(/<reportingOwner>[\s\S]*?<\/reportingOwner>/i)?.[0] ?? "";
  const reportingOwnerName = extractTag(ownerBlock, "rptOwnerName");
  const reportingOwnerRole = parseForm4Role(ownerBlock);

  const transactions = [
    ...parseForm4TransactionBlocks(xml, "nonDerivativeTable", false),
    ...parseForm4TransactionBlocks(xml, "derivativeTable", true),
  ];

  return transactions.map((tx) => ({
    ...tx,
    issuerTicker,
    issuerName,
    reportingOwnerName,
    reportingOwnerRole,
  }));
}

// The document URL comes straight from fetchCompanyForm4Filings's search
// hit — no index.json lookup needed here the way 13F's
// findInformationTableFilename requires, since the full-text search
// result already names the exact primary document.
export async function fetchAndParseForm4(documentUrl: string): Promise<RawForm4Transaction[]> {
  const xml = await fetchText(documentUrl);
  if (!xml) return [];

  return parseForm4Xml(xml);
}
