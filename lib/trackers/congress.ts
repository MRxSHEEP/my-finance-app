import { prisma } from "@/lib/prisma";
import { buildDedupeKey } from "@/lib/trackers/dedupe";
import { slugify } from "@/lib/trackers/slug";
import { recomputeRangeBasedHoldings } from "@/lib/trackers/holdings";

// FMP's free-tier plan confirmed live (2026-07) to cap these two endpoints
// at page=0 only and limit<=25 — both `page=100` and `limit=200` returned
// a 402 "Premium Query Parameter" error. There is no way to backfill past
// disclosures on this plan; each poll only ever sees whatever's currently
// in the ~25-most-recent-across-all-of-Congress rolling window. Real
// history accumulates over time as this ingestion job runs repeatedly
// (see vercel.json) — see components/trackers/TransparencyBadge.tsx for
// how this is disclosed on tracker pages rather than hidden.
const FMP_PAGE_LIMIT = 25;

interface FmpCongressTrade {
  symbol: string;
  disclosureDate: string;
  transactionDate: string;
  firstName: string;
  lastName: string;
  office: string;
  district?: string;
  owner: string;
  assetDescription: string;
  assetType: string;
  type: string;
  amount: string;
  link: string;
}

async function fetchFmpFeed(endpoint: "senate-latest" | "house-latest"): Promise<FmpCongressTrade[]> {
  const apiKey = process.env.FMP_API_KEY;
  if (!apiKey) return [];

  try {
    const search = new URLSearchParams({ page: "0", limit: String(FMP_PAGE_LIMIT), apikey: apiKey });
    const response = await fetch(`https://financialmodelingprep.com/stable/${endpoint}?${search.toString()}`);
    if (!response.ok) {
      console.error(`[congress] ${endpoint} request failed — status ${response.status}`);
      return [];
    }
    const body = await response.json().catch(() => null);
    return Array.isArray(body) ? body : [];
  } catch (err) {
    console.error(`[congress] ${endpoint} request threw: ${err instanceof Error ? err.message : String(err)}`);
    return [];
  }
}

// Congressional disclosures report a dollar-value RANGE, never an exact
// figure ("$1,001 - $15,000") — occasionally a single value with no
// dash ("$1,000,000+"). Parsed defensively; anything unparseable leaves
// both bounds null rather than guessing.
function parseAmountRange(raw: string): { low: number | null; high: number | null } {
  const numbers = raw.match(/[\d,]+/g)?.map((n) => Number(n.replace(/,/g, ""))) ?? [];
  if (numbers.length >= 2) return { low: numbers[0], high: numbers[1] };
  if (numbers.length === 1) return { low: numbers[0], high: null };
  return { low: null, high: null };
}

function classifyType(type: string): string {
  const lower = type.toLowerCase();
  if (lower.includes("exchange")) return "exchange";
  if (lower.includes("partial")) return "partial_sell";
  if (lower.includes("sale") || lower.includes("sell")) return "sell";
  if (lower.includes("purchase") || lower.includes("buy")) return "buy";
  return "other";
}

async function upsertEntity(trade: FmpCongressTrade, chamber: "Senator" | "Representative"): Promise<string> {
  const name = `${trade.firstName} ${trade.lastName}`.trim();
  const slug = slugify(name);
  const title = trade.district ? `U.S. ${chamber} (${trade.district})` : `U.S. ${chamber}`;

  const entity = await prisma.trackedEntity.upsert({
    where: { slug },
    update: { title, congressOffice: trade.office },
    create: { slug, type: "congress", name, title, congressOffice: trade.office },
  });
  return entity.id;
}

export interface CongressIngestResult {
  fetched: number;
  created: number;
}

export async function ingestCongressTrades(): Promise<CongressIngestResult> {
  const [senate, house] = await Promise.all([fetchFmpFeed("senate-latest"), fetchFmpFeed("house-latest")]);

  const all: Array<{ trade: FmpCongressTrade; chamber: "Senator" | "Representative"; sourceType: string }> = [
    ...senate.map((trade) => ({ trade, chamber: "Senator" as const, sourceType: "congress_senate" })),
    ...house.map((trade) => ({ trade, chamber: "Representative" as const, sourceType: "congress_house" })),
  ];

  let created = 0;
  const touchedEntityIds = new Set<string>();

  for (const { trade, chamber, sourceType } of all) {
    if (!trade.symbol || trade.assetType !== "Stock") continue;

    const trackedEntityId = await upsertEntity(trade, chamber);
    touchedEntityIds.add(trackedEntityId);
    const { low, high } = parseAmountRange(trade.amount);
    const transactionType = classifyType(trade.type);
    const reportedDate = trade.transactionDate || null;

    const dedupeKey = buildDedupeKey({
      sourceType,
      trackedEntitySlug: slugify(`${trade.firstName} ${trade.lastName}`),
      ticker: trade.symbol,
      reportedDate,
      transactionType,
      amountLow: low,
      amountHigh: high,
      exactValue: null,
      shares: null,
    });

    const result = await prisma.trackerTransaction.upsert({
      where: { dedupeKey },
      update: {},
      create: {
        trackedEntityId,
        ticker: trade.symbol,
        issuerName: trade.assetDescription,
        transactionType,
        reportedDate: reportedDate ? new Date(reportedDate) : null,
        disclosureDate: trade.disclosureDate ? new Date(trade.disclosureDate) : null,
        amountLow: low,
        amountHigh: high,
        isEstimate: true,
        sourceType,
        sourceUrl: trade.link ?? null,
        dedupeKey,
      },
    });

    // Prisma upsert doesn't report whether it hit create or update — a
    // freshly-created row's createdAt is (to the millisecond) "now",
    // cheap enough to check without a second round-trip.
    if (Date.now() - result.createdAt.getTime() < 5000) created++;
  }

  for (const entityId of touchedEntityIds) {
    await recomputeRangeBasedHoldings(entityId);
  }

  return { fetched: all.length, created };
}
