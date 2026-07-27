import { prisma } from "@/lib/prisma";
import { buildDedupeKey } from "@/lib/trackers/dedupe";
import { slugify } from "@/lib/trackers/slug";
import { recomputeRangeBasedHoldings } from "@/lib/trackers/holdings";
import type { UnparsedBlock } from "@/lib/trackers/ptrPdfParser";

// Shared normalized shape both lib/trackers/houseClerk.ts (PDF-derived) and
// lib/trackers/senateEfd.ts (HTML-table-derived) reduce their very
// differently-shaped raw sources down to, so this one function is the only
// place that writes TrackedEntity/TrackerTransaction/ParsedFilingCache rows
// for the free congress-PDF pipeline.
export interface NormalizedCongressTransaction {
  ticker: string | null;
  assetDescription: string | null;
  transactionType: string; // "buy" | "sell" | "partial_sell" | "exchange" | "other"
  transactionDate: string | null; // MM/DD/YYYY as filed
  amountLow: number | null;
  amountHigh: number | null;
}

export interface PersistFilingParams {
  chamber: "house" | "senate";
  filingId: string;
  sourceUrl: string;
  filerName: string;
  chamberTitle: string; // e.g. "U.S. Representative (MO04)" or "U.S. Senator"
  disclosureDate: string | null; // filing-level date (MM/DD/YYYY as filed)
  sourceType: "congress_house_pdf" | "congress_senate_pdf";
  transactions: NormalizedCongressTransaction[];
  usedOcr: boolean;
  unparsed: UnparsedBlock[];
}

export interface PersistFilingResult {
  transactionsCreated: number;
  needsReview: boolean;
}

function toDate(mmddyyyy: string | null): Date | null {
  if (!mmddyyyy) return null;
  const [m, d, y] = mmddyyyy.split("/").map(Number);
  if (!m || !d || !y) return null;
  return new Date(Date.UTC(y, m - 1, d));
}

export async function persistCongressFiling(params: PersistFilingParams): Promise<PersistFilingResult> {
  const slug = slugify(params.filerName);
  const disclosureDate = toDate(params.disclosureDate);

  const entity = await prisma.trackedEntity.upsert({
    where: { slug },
    update: { name: params.filerName, title: params.chamberTitle },
    create: { slug, type: "congress", name: params.filerName, title: params.chamberTitle },
  });

  let transactionsCreated = 0;
  for (const tx of params.transactions) {
    const dedupeKey = buildDedupeKey({
      sourceType: params.sourceType,
      trackedEntitySlug: slug,
      ticker: tx.ticker,
      reportedDate: tx.transactionDate,
      transactionType: tx.transactionType,
      amountLow: tx.amountLow,
      amountHigh: tx.amountHigh,
      exactValue: null,
      shares: null,
    });

    const result = await prisma.trackerTransaction.upsert({
      where: { dedupeKey },
      update: { sourceUrl: params.sourceUrl },
      create: {
        trackedEntityId: entity.id,
        ticker: tx.ticker,
        issuerName: tx.assetDescription,
        transactionType: tx.transactionType,
        reportedDate: toDate(tx.transactionDate),
        disclosureDate,
        amountLow: tx.amountLow,
        amountHigh: tx.amountHigh,
        isEstimate: true,
        sourceType: params.sourceType,
        sourceUrl: params.sourceUrl,
        dedupeKey,
      },
    });
    if (Date.now() - result.createdAt.getTime() < 5000) transactionsCreated++;
  }

  if (params.transactions.length > 0) {
    await recomputeRangeBasedHoldings(entity.id);
  }

  const needsReview = params.unparsed.length > 0;
  await prisma.parsedFilingCache.upsert({
    where: { chamber_filingId: { chamber: params.chamber, filingId: params.filingId } },
    update: {},
    create: {
      chamber: params.chamber,
      filingId: params.filingId,
      sourceUrl: params.sourceUrl,
      filerName: params.filerName,
      disclosureDate,
      usedOcr: params.usedOcr,
      transactionCount: params.transactions.length,
      unparsedCount: params.unparsed.length,
      unparsedDetail: params.unparsed.length > 0 ? (params.unparsed as unknown as object[]) : undefined,
      needsReview,
    },
  });

  return { transactionsCreated, needsReview };
}

// Batched "which of these filingIds have I already parsed" check — avoids
// one query per candidate filing when a search turns up dozens of rows.
export async function findAlreadyParsedFilingIds(chamber: "house" | "senate", filingIds: string[]): Promise<Set<string>> {
  if (filingIds.length === 0) return new Set();
  const rows = await prisma.parsedFilingCache.findMany({
    where: { chamber, filingId: { in: filingIds } },
    select: { filingId: true },
  });
  return new Set(rows.map((r) => r.filingId));
}
