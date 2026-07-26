import { prisma } from "@/lib/prisma";
import { buildDedupeKey } from "@/lib/trackers/dedupe";
import { slugify } from "@/lib/trackers/slug";
import { fetchAndParseForm4, fetchCompanyForm4Filings, type RawForm4Transaction } from "@/lib/trackers/secEdgar";

// A "Company Insiders" tracker is per-company (aggregating every insider's
// Form 4 filings for that ticker), not per-individual-person — matches
// how the Trackers directory categorizes "Company Insiders" as its own
// bucket distinct from named investors. CIKs confirmed live against SEC's
// own company_tickers.json (https://www.sec.gov/files/company_tickers.json)
// before writing this list, same "verify, don't guess" standard as
// lib/trackers/thirteenF.ts's fund CIKs.
const SEEDED_INSIDER_COMPANIES: Record<string, { name: string; cik: string }> = {
  AAPL: { name: "Apple Inc.", cik: "320193" },
  MSFT: { name: "Microsoft Corp.", cik: "789019" },
  GOOGL: { name: "Alphabet Inc.", cik: "1652044" },
  AMZN: { name: "Amazon.com Inc.", cik: "1018724" },
  NVDA: { name: "NVIDIA Corp.", cik: "1045810" },
  META: { name: "Meta Platforms Inc.", cik: "1326801" },
  TSLA: { name: "Tesla Inc.", cik: "1318605" },
  JPM: { name: "JPMorgan Chase", cik: "19617" },
  BAC: { name: "Bank of America", cik: "70858" },
  GS: { name: "Goldman Sachs", cik: "886982" },
  JNJ: { name: "Johnson & Johnson", cik: "200406" },
  UNH: { name: "UnitedHealth Group", cik: "731766" },
  PFE: { name: "Pfizer Inc.", cik: "78003" },
  XOM: { name: "Exxon Mobil", cik: "2115436" },
  CVX: { name: "Chevron", cik: "93410" },
  WMT: { name: "Walmart", cik: "104169" },
  HD: { name: "Home Depot", cik: "354950" },
  DIS: { name: "Walt Disney", cik: "1744489" },
  NFLX: { name: "Netflix", cik: "1065280" },
  BA: { name: "Boeing", cik: "12927" },
  ABNB: { name: "Airbnb Inc.", cik: "1559720" },
  CRWD: { name: "CrowdStrike Holdings Inc.", cik: "1535527" },
};

// How many of a company's most recent Form 4 filings to check per
// ingestion run. Each filing needs its own index.json + XML fetch (2
// throttled EDGAR calls, see lib/trackers/edgarThrottle.ts), so this is
// sized to keep one ingestion run's total EDGAR calls modest across 22
// seeded companies rather than to reflect any real cap of EDGAR's own.
const FILINGS_PER_COMPANY = 15;

// SEC Form 4 standard transaction codes. Codes not listed fall through to
// "other" rather than being guessed at.
function classifyTransactionCode(code: string | null): string {
  switch (code) {
    case "P":
      return "buy";
    case "S":
      return "sell";
    case "M":
    case "X":
      return "option_exercise";
    case "G":
      return "gift";
    case "A":
      return "award";
    case "F":
      // Shares withheld by the company to cover tax on vesting — not a
      // market sale, kept distinct so it's never counted as one (matches
      // app/api/stock/insiders/route.ts's existing net-sentiment
      // reasoning for the same distinction).
      return "tax_withholding";
    default:
      return "other";
  }
}

async function upsertEntity(ticker: string, companyName: string): Promise<string> {
  const slug = `${slugify(ticker)}-insiders`;
  const entity = await prisma.trackedEntity.upsert({
    where: { slug },
    update: {},
    create: { slug, type: "insider", name: `${companyName} Insiders`, title: `Company insider activity (${ticker})` },
  });
  return entity.id;
}

export interface InsiderIngestResult {
  ticker: string;
  filingsSeen: number;
  filingsSkippedCached: number;
  filingsParsed: number;
  transactionsCreated: number;
}

async function ingestOneCompany(ticker: string, name: string, cik: string): Promise<InsiderIngestResult> {
  const trackedEntityId = await upsertEntity(ticker, name);
  const filings = await fetchCompanyForm4Filings(cik, FILINGS_PER_COMPANY);

  if (filings.length === 0) {
    return { ticker, filingsSeen: 0, filingsSkippedCached: 0, filingsParsed: 0, transactionsCreated: 0 };
  }

  // EDGAR filings are immutable once filed — a filing already represented
  // in the DB has nothing new to gain from re-fetching, so this checks
  // which of the candidate filings are already known *before* spending an
  // EDGAR request on them, rather than an in-memory TTL cache that would
  // reset on every server restart and still re-fetch on the first hit
  // after one.
  const alreadyIngested = await prisma.trackerTransaction.findMany({
    where: { trackedEntityId, sourceType: "insider_form4", sourceUrl: { in: filings.map((f) => f.indexUrl) } },
    select: { sourceUrl: true },
    distinct: ["sourceUrl"],
  });
  const cachedUrls = new Set(alreadyIngested.map((t) => t.sourceUrl));
  const toFetch = filings.filter((f) => !cachedUrls.has(f.indexUrl));

  let transactionsCreated = 0;

  for (const filing of toFetch) {
    const rawTransactions = await fetchAndParseForm4(filing.documentUrl);

    for (const raw of rawTransactions) {
      const transactionType = classifyTransactionCode(raw.transactionCode);
      const shares = raw.shares != null ? Math.abs(raw.shares) : null;
      const exactValue = shares != null && raw.pricePerShare != null ? shares * raw.pricePerShare : null;
      const reportedDate = raw.transactionDate;

      const dedupeKey = buildDedupeKey({
        sourceType: "insider_form4",
        trackedEntitySlug: `${slugify(ticker)}-insiders`,
        ticker: raw.issuerTicker,
        reportedDate,
        transactionType,
        amountLow: null,
        amountHigh: null,
        exactValue,
        shares,
      });

      const result = await prisma.trackerTransaction.upsert({
        where: { dedupeKey },
        update: { sourceUrl: filing.indexUrl },
        create: {
          trackedEntityId,
          ticker: raw.issuerTicker ?? ticker,
          issuerName: raw.issuerName ?? name,
          reportingPersonName: raw.reportingOwnerName,
          reportingPersonRole: raw.reportingOwnerRole,
          transactionType,
          reportedDate: reportedDate ? new Date(reportedDate) : null,
          // Form 4 must be filed within 2 business days of the trade — the
          // filing date from EDGAR's own atom feed (not derivable from
          // inside the XML itself) is the real disclosure date.
          disclosureDate: new Date(filing.filingDate),
          exactValue,
          shares,
          pricePerShare: raw.pricePerShare,
          isEstimate: false,
          sourceType: "insider_form4",
          sourceUrl: filing.indexUrl,
          dedupeKey,
        },
      });

      if (Date.now() - result.createdAt.getTime() < 5000) transactionsCreated++;
    }
  }

  return {
    ticker,
    filingsSeen: filings.length,
    filingsSkippedCached: filings.length - toFetch.length,
    filingsParsed: toFetch.length,
    transactionsCreated,
  };
}

export async function ingestInsiderForm4(): Promise<InsiderIngestResult[]> {
  const results: InsiderIngestResult[] = [];
  // Sequential — every filing needs 2 of its own throttled EDGAR calls
  // already (see lib/trackers/edgarThrottle.ts); no reason to also queue
  // multiple companies' worth of calls concurrently against the same
  // shared per-process throttle.
  for (const [ticker, { name, cik }] of Object.entries(SEEDED_INSIDER_COMPANIES)) {
    results.push(await ingestOneCompany(ticker, name, cik));
  }
  return results;
}

export type { RawForm4Transaction };
