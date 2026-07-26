import { extractPdfPages } from "@/lib/trackers/pdfExtract";
import { ocrPdfPage } from "@/lib/trackers/ocrFallback";

export interface ParsedPtrTransaction {
  owner: string; // "Self" | "Spouse" | "Joint" | "Dependent Child" (best-effort from the filing's own owner code)
  assetDescription: string;
  ticker: string | null;
  transactionType: string; // "buy" | "sell" | "partial_sell" | "exchange" | "other"
  transactionDate: string | null; // MM/DD/YYYY as filed
  notificationDate: string | null; // MM/DD/YYYY as filed — this PDF's own "notification date" field
  amountRangeLow: number | null;
  amountRangeHigh: number | null;
  // The exact range TEXT as printed, e.g. "$1,001 - $15,000" — captured
  // verbatim per the task's explicit instruction never to average a range
  // into a fake precise number; amountRangeLow/High are a parsed version
  // of the same text for querying, not a replacement for it.
  amountRangeText: string;
}

export interface UnparsedBlock {
  line: string;
  reason: string;
  context?: string;
}

export interface ParsedPtr {
  filerName: string | null;
  transactions: ParsedPtrTransaction[];
  unparsed: UnparsedBlock[];
  // True if any page needed the OCR fallback path (lib/trackers/ocrFallback.ts)
  // rather than direct text extraction.
  usedOcr: boolean;
}

const OWNER_CODES: Record<string, string> = { SP: "Spouse", JT: "Joint", DC: "Dependent Child" };

// Boilerplate that repeats on every page (column headers reprinted per
// page, the cover-page title block) or trails the transaction table
// (the asset-type-code legend and the IPO/comments section) — stripped
// before row-parsing so a transaction that wraps across a page boundary
// doesn't have its continuation line mistaken for a repeated header.
// Confirmed against a real filing (Pelosi, filing #20033725) live.
const BOILERPLATE_LINE_PATTERNS: RegExp[] = [
  /^Filing ID #/,
  /^Clerk of the House of Representatives/,
  /^ID Owner Asset Transaction Date/,
  /^Type Date Gains/,
  /^\$200\?$/,
  /^\* For the complete list of asset type abbreviations/,
];

// Once this line is seen, everything after it is the form's trailing
// IPO/comments section, not transaction data.
const TRAILING_SECTION_MARKER = /^\* For the complete list of asset type abbreviations/;

const TX_TYPE_PATTERN = "S \\(partial\\)|P|S|E";
// The amount-range's high value renders in two genuinely different ways
// depending on the filer's own asset-description length (confirmed live
// across real filings, not a guess): short descriptions leave enough room
// for the FULL "$1,001 - $15,000" range on one line (group 7 below), while
// longer ones push the row onto two physical lines, splitting the range's
// dash from its high value (group 8, a bare trailing "-" meaning "look at
// the next line") — the original version of this regex only handled the
// second case, which silently produced zero matches (and, worse, zero
// `unparsed` entries either, since a totally-unmatched line was never
// flagged at all) against several real filers' PDFs that use the first.
const ROW_START_RE = new RegExp(
  `^(SP|JT|DC)?\\s*(.+?)\\s+(${TX_TYPE_PATTERN})\\s+(\\d{2}/\\d{2}/\\d{4})\\s+(\\d{2}/\\d{2}/\\d{4})\\s+(\\$[\\d,]+(?:\\.\\d{2})?)\\s*(?:-\\s*(\\$[\\d,]+(?:\\.\\d{2})?)|(-))?\\s*$`
);
const AMOUNT_CONTINUATION_RE = /^(.*?)\s*(\$[\d,]+(?:\.\d{2})?)\s*$/;
const TICKER_RE = /\(([A-Z]{1,6})\)/;
// A loose heuristic for "this line probably was a transaction row" — used
// only to flag rows the strict ROW_START_RE above failed to match at all,
// so a real filing with real content never silently reports zero
// transactions AND zero unparsed entries (which looks identical to "this
// filer genuinely had nothing to report").
const LOOKS_LIKE_TX_ROW_RE = /\d{2}\/\d{2}\/\d{4}.*\$[\d,]+/;

function classifyTxType(rawType: string): string {
  if (rawType === "P") return "buy";
  if (rawType === "S") return "sell";
  if (rawType === "S (partial)") return "partial_sell";
  if (rawType === "E") return "exchange";
  return "other";
}

function cleanAssetName(raw: string): string {
  return raw
    .replace(/\s*\([A-Z]{1,6}\)\s*\[[A-Z]{1,4}\]\s*$/, "")
    .replace(/\s*\[[A-Z]{1,4}\]\s*$/, "")
    .trim();
}

function parseAmount(text: string): number {
  return Number(text.replace(/[$,]/g, ""));
}

export function parsePtrLines(allLines: string[]): Omit<ParsedPtr, "usedOcr"> {
  const filerNameLine = allLines.find((l) => l.startsWith("Name:"));
  const filerName = filerNameLine ? filerNameLine.replace(/^Name:\s*/, "").trim() : null;

  const filteredLines: string[] = [];
  for (const line of allLines) {
    if (TRAILING_SECTION_MARKER.test(line)) break;
    if (BOILERPLATE_LINE_PATTERNS.some((re) => re.test(line))) continue;
    filteredLines.push(line);
  }

  const transactions: ParsedPtrTransaction[] = [];
  const unparsed: UnparsedBlock[] = [];
  const consumed = new Set<number>();

  for (let i = 0; i < filteredLines.length; i++) {
    const line = filteredLines[i];
    const match = line.match(ROW_START_RE);
    if (!match) continue;

    const [, ownerCode, assetPart1, rawTxType, transactionDate, notificationDate, amountLowText, inlineHighText, trailingDash] = match;
    let assetFull = assetPart1;
    let amountHighText: string | null = inlineHighText ?? null;
    let ticker = assetPart1.match(TICKER_RE)?.[1] ?? null;
    consumed.add(i);

    if (trailingDash === "-") {
      const next = filteredLines[i + 1];
      const contMatch = next?.match(AMOUNT_CONTINUATION_RE);
      if (!contMatch) {
        unparsed.push({
          line,
          reason: "amount range appeared to continue onto the next line, but no matching continuation was found (often a page-break interrupting a wrapped row)",
          context: next,
        });
        continue;
      }
      assetFull += " " + contMatch[1];
      amountHighText = contMatch[2];
      if (!ticker) ticker = contMatch[1].match(TICKER_RE)?.[1] ?? null;
      consumed.add(i + 1);
      i++; // consume the continuation line
    }

    const amountRangeText = amountHighText ? `${amountLowText} - ${amountHighText}` : amountLowText;

    transactions.push({
      owner: ownerCode ? (OWNER_CODES[ownerCode] ?? ownerCode) : "Self",
      assetDescription: cleanAssetName(assetFull),
      ticker,
      transactionType: classifyTxType(rawTxType),
      transactionDate,
      notificationDate,
      amountRangeLow: parseAmount(amountLowText),
      amountRangeHigh: amountHighText ? parseAmount(amountHighText) : null,
      amountRangeText,
    });
  }

  // Closes the blind spot a real filing (Julie Johnson's, house filing
  // #20033789) exposed live: a line that looks exactly like a transaction
  // row but doesn't match ROW_START_RE's strict structure was previously
  // just skipped — invisible both as a parsed transaction AND as an
  // `unparsed` entry, indistinguishable from "this filer had nothing to
  // report." Any not-yet-consumed line matching the loose date+amount
  // heuristic gets flagged here instead.
  for (let i = 0; i < filteredLines.length; i++) {
    if (consumed.has(i)) continue;
    if (LOOKS_LIKE_TX_ROW_RE.test(filteredLines[i])) {
      unparsed.push({ line: filteredLines[i], reason: "line looks like a transaction row (has a date and a dollar amount) but didn't match the expected row structure" });
    }
  }

  return { filerName, transactions, unparsed };
}

export async function parsePtrPdf(pdfBytes: Uint8Array): Promise<ParsedPtr> {
  const pages = await extractPdfPages(pdfBytes);
  let usedOcr = false;
  const ocrFailures: UnparsedBlock[] = [];

  const allLines: string[] = [];
  for (const page of pages) {
    if (page.looksScanned) {
      usedOcr = true;
      // A single page's OCR failing (a malformed/oddly-encoded scanned
      // image pdf.js's renderer chokes on — confirmed live against a real
      // filing whose embedded scan uses a JBIG2 codec pdf.js's Node build
      // can't fully decode) should flag that page for manual review, not
      // take down parsing of the filing's other pages with it.
      try {
        const ocrLines = await ocrPdfPage(pdfBytes, page.pageNumber);
        allLines.push(...ocrLines);
      } catch (err) {
        ocrFailures.push({
          line: `(page ${page.pageNumber})`,
          reason: `OCR failed for this scanned page: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    } else {
      allLines.push(...page.lines);
    }
  }

  const parsed = parsePtrLines(allLines);
  return { ...parsed, unparsed: [...parsed.unparsed, ...ocrFailures], usedOcr };
}
