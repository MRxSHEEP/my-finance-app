import { prisma } from "@/lib/prisma";
import { buildDedupeKey } from "@/lib/trackers/dedupe";
import { fetchInformationTable, fetchLatest13F, fetchRecent13Fs } from "@/lib/trackers/secEdgar";
import { resolveIssuerToTicker } from "@/lib/trackers/tickerResolve";

// How many past quarters to backfill for the performance-history chart —
// real 13F data, not synthetic. 5 quarters gives a "since ~last year"
// return series without fetching every quarter a fund has ever filed.
const PERFORMANCE_BACKFILL_QUARTERS = 5;

// Real funds file 13F-HR quarterly and it can list hundreds to thousands
// of line items (quant funds especially) — capped to the top N by
// reported value per filing, since that's what "current holdings"/"top
// winners and losers" on a tracker page actually needs, not an exhaustive
// dump of every sub-$10k stat-arb position.
const MAX_POSITIONS_PER_FILING = 50;

export interface SeedFund {
  slug: string;
  name: string;
  title: string;
  cik: string;
  type: "hedge_fund" | "investor";
}

// CIKs confirmed live against SEC EDGAR's own company search
// (browse-edgar?action=getcompany&type=13F-HR) before writing this list.
export const SEEDED_FUNDS: SeedFund[] = [
  { slug: "berkshire-hathaway", name: "Berkshire Hathaway", title: "Chairman & CEO: Warren Buffett", cik: "0001067983", type: "hedge_fund" },
  { slug: "bridgewater-associates", name: "Bridgewater Associates", title: "Hedge Fund", cik: "0001350694", type: "hedge_fund" },
  { slug: "citadel-advisors", name: "Citadel Advisors", title: "Hedge Fund", cik: "0001423053", type: "hedge_fund" },
  { slug: "renaissance-technologies", name: "Renaissance Technologies", title: "Hedge Fund", cik: "0001037389", type: "hedge_fund" },
  { slug: "michael-burry-scion", name: "Michael Burry (Scion Asset Management)", title: "Founder: Michael Burry", cik: "0001649339", type: "investor" },
  { slug: "bill-ackman-pershing-square", name: "Bill Ackman (Pershing Square)", title: "Founder & CEO: Bill Ackman", cik: "0001336528", type: "investor" },
  { slug: "cathie-wood-ark", name: "Cathie Wood (ARK Invest)", title: "Founder & CEO: Cathie Wood", cik: "0001697748", type: "investor" },
];

async function upsertEntity(fund: SeedFund): Promise<string> {
  const entity = await prisma.trackedEntity.upsert({
    where: { slug: fund.slug },
    update: { name: fund.name, title: fund.title, secCik: fund.cik },
    create: { slug: fund.slug, type: fund.type, name: fund.name, title: fund.title, secCik: fund.cik },
  });
  return entity.id;
}

export interface ThirteenFIngestResult {
  fund: string;
  filingDate: string | null;
  positionsResolved: number;
  positionsUnresolved: number;
  transactionsCreated: number;
}

async function ingestOneFund(fund: SeedFund): Promise<ThirteenFIngestResult> {
  const trackedEntityId = await upsertEntity(fund);
  const latest = await fetchLatest13F(fund.cik);
  if (!latest) {
    return { fund: fund.name, filingDate: null, positionsResolved: 0, positionsUnresolved: 0, transactionsCreated: 0 };
  }

  const rawPositions = await fetchInformationTable(fund.cik, latest.accessionNumber);
  const topPositions = [...rawPositions].sort((a, b) => b.value - a.value).slice(0, MAX_POSITIONS_PER_FILING);

  const existingHoldings = await prisma.trackerHolding.findMany({ where: { trackedEntityId } });
  // Keyed the same way as newByTicker below (ticker if resolved, else a
  // name-based key) so an unresolved position can still be diffed against
  // its own prior snapshot instead of always looking "new."
  const existingByKey = new Map(
    existingHoldings.map((h) => [h.ticker ?? `unresolved:${h.issuerName}`, h])
  );

  const filingDate = new Date(latest.filingDate);
  let positionsResolved = 0;
  let positionsUnresolved = 0;
  let transactionsCreated = 0;
  const newByTicker = new Map<string, { shares: number; value: number; issuerName: string }>();

  for (const position of topPositions) {
    const ticker = await resolveIssuerToTicker(position.nameOfIssuer);
    if (ticker) positionsResolved++;
    else positionsUnresolved++;

    // Multiple info-table rows can report the same issuer split across
    // different investment-discretion/manager sub-entries — combine them
    // into one position per (resolved-or-not) key, same as EDGAR viewers do.
    const key = ticker ?? `unresolved:${position.nameOfIssuer}`;
    const existing = newByTicker.get(key);
    newByTicker.set(key, {
      shares: (existing?.shares ?? 0) + position.shares,
      value: (existing?.value ?? 0) + position.value, // already actual USD — see Raw13FPosition's comment
      issuerName: position.nameOfIssuer,
    });
  }

  const filingIndexUrl = `https://www.sec.gov/Archives/edgar/data/${Number(fund.cik)}/${latest.accessionNumber.replace(/-/g, "")}/${latest.accessionNumber}-index.html`;

  for (const [key, position] of newByTicker) {
    const ticker = key.startsWith("unresolved:") ? null : key;
    const previous = existingByKey.get(key);
    const previousShares = previous?.shares ?? 0;
    const delta = position.shares - previousShares;

    if (delta !== 0) {
      // First time this entity has ever been ingested (no prior holdings
      // at all) gets its own transaction type — it's the fund's known
      // baseline as of this filing, not a detected change from a prior
      // quarter, and the UI should not present it as "recent activity."
      const transactionType =
        existingHoldings.length === 0 ? "initial_position" : delta > 0 ? "buy" : previousShares > 0 && position.shares > 0 ? "partial_sell" : "sell";

      const perShareValue = position.shares > 0 ? position.value / position.shares : null;
      const exactValue = perShareValue !== null ? Math.abs(delta) * perShareValue : null;
      const reportedDateStr = latest.filingDate;

      const dedupeKey = buildDedupeKey({
        sourceType: "13f",
        trackedEntitySlug: fund.slug,
        ticker,
        reportedDate: reportedDateStr,
        transactionType,
        amountLow: null,
        amountHigh: null,
        exactValue,
        shares: Math.abs(delta),
      });

      const result = await prisma.trackerTransaction.upsert({
        where: { dedupeKey },
        update: { sourceUrl: filingIndexUrl },
        create: {
          trackedEntityId,
          ticker,
          issuerName: position.issuerName,
          transactionType,
          // 13F reports a quarter-end snapshot, not a per-trade date — the
          // actual trade date within the quarter isn't knowable from this
          // filing, so only reportedDate/disclosureDate are set, never
          // tradeDate (see components/trackers/TransparencyBadge.tsx).
          reportedDate: filingDate,
          disclosureDate: filingDate,
          shares: Math.abs(delta),
          exactValue,
          isEstimate: false,
          sourceType: "13f",
          // The specific filing's own index page, not a generic search.
          sourceUrl: filingIndexUrl,
          dedupeKey,
        },
      });
      if (Date.now() - result.createdAt.getTime() < 5000) transactionsCreated++;
    }
  }

  // Backfills the source link on every transaction from *this specific*
  // filing — separate from the per-position loop above, which only
  // touches positions whose share count actually changed this run.
  // Scoped to this filing's own reportedDate (not every 13f transaction
  // this entity has ever had) so an older quarter's transactions keep
  // pointing at their own filing rather than getting overwritten with
  // this one's URL once a later quarter's ingestion runs.
  await prisma.trackerTransaction.updateMany({
    where: { trackedEntityId, sourceType: "13f", reportedDate: filingDate },
    data: { sourceUrl: filingIndexUrl },
  });

  // Fully replace the holdings snapshot — a 13F filing supersedes the
  // prior quarter's entirely, this isn't an accumulating feed like
  // congress/insider transactions are.
  await prisma.trackerHolding.deleteMany({ where: { trackedEntityId } });
  for (const [key, position] of newByTicker) {
    const ticker = key.startsWith("unresolved:") ? null : key;
    if (ticker) {
      await prisma.trackerHolding.upsert({
        where: { trackedEntityId_ticker: { trackedEntityId, ticker } },
        update: { shares: position.shares, estimatedValue: position.value, issuerName: position.issuerName, asOfDate: filingDate, isEstimate: false },
        create: { trackedEntityId, ticker, shares: position.shares, estimatedValue: position.value, issuerName: position.issuerName, asOfDate: filingDate, isEstimate: false },
      });
    } else {
      await prisma.trackerHolding.create({
        data: { trackedEntityId, ticker: null, shares: position.shares, estimatedValue: position.value, issuerName: position.issuerName, asOfDate: filingDate, isEstimate: false },
      });
    }
  }

  return { fund: fund.name, filingDate: latest.filingDate, positionsResolved, positionsUnresolved, transactionsCreated };
}

export async function ingestAllThirteenF(): Promise<ThirteenFIngestResult[]> {
  const results: ThirteenFIngestResult[] = [];
  // Sequential, not Promise.all — SEC asks for a reasonable request rate
  // and each fund needs 2-3 sequential EDGAR calls of its own already.
  for (const fund of SEEDED_FUNDS) {
    results.push(await ingestOneFund(fund));
  }
  return results;
}

export interface PerformanceBackfillResult {
  fund: string;
  quartersRecorded: number;
}

// One-time (idempotent — @@unique([trackedEntityId, asOfDate]) skips
// quarters already recorded) backfill of real historical portfolio value
// per fund, so a return chart has more than the single most-recent data
// point immediately rather than waiting up to a year for enough quarterly
// polls to accumulate on their own. Total value is summed across EVERY
// reported position in each quarter's filing, not just the top-N this
// app stores at the holding level — a fund with thousands of small
// positions would otherwise show an understated total.
export async function backfillPerformanceHistory(): Promise<PerformanceBackfillResult[]> {
  const results: PerformanceBackfillResult[] = [];

  for (const fund of SEEDED_FUNDS) {
    const trackedEntityId = await upsertEntity(fund);
    const filings = await fetchRecent13Fs(fund.cik, PERFORMANCE_BACKFILL_QUARTERS);
    let quartersRecorded = 0;

    for (const filing of filings) {
      const existing = await prisma.trackerPerformanceSnapshot.findUnique({
        where: { trackedEntityId_asOfDate: { trackedEntityId, asOfDate: new Date(filing.filingDate) } },
      });
      if (existing) continue;

      const positions = await fetchInformationTable(fund.cik, filing.accessionNumber);
      const totalValue = positions.reduce((sum, p) => sum + p.value, 0);
      if (totalValue <= 0) continue;

      await prisma.trackerPerformanceSnapshot.create({
        data: { trackedEntityId, asOfDate: new Date(filing.filingDate), totalValue },
      });
      quartersRecorded++;
    }

    results.push({ fund: fund.name, quartersRecorded });
  }

  return results;
}
