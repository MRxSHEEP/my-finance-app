import { prisma } from "@/lib/prisma";

export interface NotableHolder {
  slug: string;
  name: string;
  type: string;
  title: string | null;
  shares: number | null;
  estimatedValue: number | null;
  isEstimate: boolean;
  asOfDate: string;
}

export interface RecentActivityEntry {
  entitySlug: string;
  entityName: string;
  entityType: string;
  transactionType: string;
  reportedDate: string | null;
  disclosureDate: string | null;
  reportingPersonName: string | null;
  sourceUrl: string | null;
}

export interface NotableHoldersData {
  congressHolderCount: number;
  hedgeFundHolderCount: number;
  recentInsiderTransactionCount: number;
  holders: NotableHolder[];
  recentActivity: RecentActivityEntry[];
}

const RECENT_ACTIVITY_WINDOW_DAYS = 180;
const MAX_RECENT_ACTIVITY = 15;

export async function getNotableHoldersForTicker(ticker: string): Promise<NotableHoldersData> {
  const upperTicker = ticker.toUpperCase();

  const holdings = await prisma.trackerHolding.findMany({
    where: { ticker: upperTicker },
    include: { trackedEntity: true },
    orderBy: { estimatedValue: "desc" },
  });

  const holders: NotableHolder[] = holdings.map((h) => ({
    slug: h.trackedEntity.slug,
    name: h.trackedEntity.name,
    type: h.trackedEntity.type,
    title: h.trackedEntity.title,
    shares: h.shares,
    estimatedValue: h.estimatedValue,
    isEstimate: h.isEstimate,
    asOfDate: h.asOfDate.toISOString(),
  }));

  const congressHolderCount = holders.filter((h) => h.type === "congress").length;
  const hedgeFundHolderCount = holders.filter((h) => h.type === "hedge_fund" || h.type === "investor").length;

  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - RECENT_ACTIVITY_WINDOW_DAYS);

  const recentTransactions = await prisma.trackerTransaction.findMany({
    where: {
      ticker: upperTicker,
      OR: [{ reportedDate: { gte: cutoff } }, { disclosureDate: { gte: cutoff } }],
    },
    include: { trackedEntity: true },
    orderBy: [{ reportedDate: "desc" }, { disclosureDate: "desc" }],
    take: MAX_RECENT_ACTIVITY,
  });

  const recentInsiderTransactionCount = await prisma.trackerTransaction.count({
    where: {
      ticker: upperTicker,
      sourceType: "insider_form4",
      OR: [{ reportedDate: { gte: cutoff } }, { disclosureDate: { gte: cutoff } }],
    },
  });

  const recentActivity: RecentActivityEntry[] = recentTransactions.map((tx) => ({
    entitySlug: tx.trackedEntity.slug,
    entityName: tx.trackedEntity.name,
    entityType: tx.trackedEntity.type,
    transactionType: tx.transactionType,
    reportedDate: tx.reportedDate?.toISOString() ?? null,
    disclosureDate: tx.disclosureDate?.toISOString() ?? null,
    reportingPersonName: tx.reportingPersonName,
    sourceUrl: tx.sourceUrl,
  }));

  return { congressHolderCount, hedgeFundHolderCount, recentInsiderTransactionCount, holders, recentActivity };
}

export interface RecentInsiderActivityEntry {
  ticker: string | null;
  issuerName: string | null;
  entityName: string;
  reportingPersonName: string | null;
  transactionType: string;
  shares: number | null;
  exactValue: number | null;
  reportedDate: string | null;
  disclosureDate: string | null;
  sourceUrl: string | null;
}

// Across-ALL-companies variant of the ticker-scoped query above — for the
// Market Digest's insider-activity section (home page), not a specific
// stock page. Reads already-ingested data only (lib/trackers/insiderForm4.ts
// owns ingestion); this never fetches/reprocesses anything. Double-filtered
// to insider_form4 AND trackedEntity.type === "insider" (not just one or
// the other) so a congress-typed row can never surface here even by
// accident — mirrors app/trackers/page.tsx's own `e.type !== "congress"`
// exclusion, the established pattern for this exact concern.
export async function getRecentInsiderActivity(limit = 10): Promise<RecentInsiderActivityEntry[]> {
  const transactions = await prisma.trackerTransaction.findMany({
    where: { sourceType: "insider_form4", trackedEntity: { type: "insider" } },
    include: { trackedEntity: true },
    orderBy: [{ disclosureDate: "desc" }, { reportedDate: "desc" }],
    take: limit,
  });

  return transactions.map((tx) => ({
    ticker: tx.ticker,
    issuerName: tx.issuerName,
    entityName: tx.trackedEntity.name,
    reportingPersonName: tx.reportingPersonName,
    transactionType: tx.transactionType,
    shares: tx.shares,
    exactValue: tx.exactValue,
    reportedDate: tx.reportedDate?.toISOString() ?? null,
    disclosureDate: tx.disclosureDate?.toISOString() ?? null,
    sourceUrl: tx.sourceUrl,
  }));
}
