import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { gatherCommodityData, gatherCryptoData, gatherStockData } from "@/lib/generatedNews/gather";
import { generateArticle } from "@/lib/generatedNews/generate";
import { factCheckArticle } from "@/lib/generatedNews/factCheck";
import type { GeneratedNewsAssetType, GeneratedNewsDataSnapshot } from "@/lib/generatedNews/types";

// Shared by both the daily watchlist cron (app/api/generated-news/ingest)
// and the on-demand personalized-holdings path
// (app/api/generated-news/ensure) — one unified pool keyed by
// (assetType, ticker), not by which trigger reached it. Whichever path
// hits a ticker first within this window wins; the other sees a fresh row
// already exists and no-ops.
const FRESHNESS_WINDOW_MS = 24 * 60 * 60_000;

export type EnsureArticleResult =
  | "published"
  | "skipped_fresh"
  | "skipped_no_data"
  | "skipped_generation_failed"
  | "skipped_fact_check_failed";

// Same hasAnyData guard app/api/signals/ingest/route.ts applies before
// ever asking Claude to generate from nothing.
function hasAnyData(data: GeneratedNewsDataSnapshot): boolean {
  return (
    data.technical.latestClose !== null ||
    data.analystRating !== null ||
    data.earnings !== null ||
    data.news.length > 0 ||
    data.insiderActivity.length > 0 ||
    data.congressActivity.length > 0
  );
}

async function gatherForAssetType(
  assetType: GeneratedNewsAssetType,
  ticker: string,
  displayName: string,
  origin: string
): Promise<GeneratedNewsDataSnapshot> {
  if (assetType === "stock") return gatherStockData(ticker, displayName, origin);
  if (assetType === "crypto") return gatherCryptoData(ticker, displayName, origin);
  return gatherCommodityData(ticker, displayName, origin);
}

export async function ensureArticleForTicker(
  assetType: GeneratedNewsAssetType,
  ticker: string,
  displayName: string,
  origin: string
): Promise<EnsureArticleResult> {
  const existing = await prisma.generatedNewsArticle.findUnique({
    where: { assetType_ticker: { assetType, ticker } },
  });
  if (existing && Date.now() - existing.generatedAt.getTime() < FRESHNESS_WINDOW_MS) {
    return "skipped_fresh";
  }

  const data = await gatherForAssetType(assetType, ticker, displayName, origin);
  if (!hasAnyData(data)) return "skipped_no_data";

  const draft = await generateArticle(data);
  if (!draft) return "skipped_generation_failed";

  const factCheck = factCheckArticle(data, draft.citedFacts);
  if (!factCheck.ok) {
    console.error(`[generatedNews] fact-check failed for ${assetType}:${ticker} — ${factCheck.failures.join("; ")}`);
    return "skipped_fact_check_failed";
  }

  await prisma.generatedNewsArticle.upsert({
    where: { assetType_ticker: { assetType, ticker } },
    update: {
      displayName,
      title: draft.title,
      body: draft.body,
      dataSnapshot: data as unknown as Prisma.InputJsonValue,
      citedFacts: draft.citedFacts as unknown as Prisma.InputJsonValue,
      generatedAt: new Date(),
    },
    create: {
      assetType,
      ticker,
      displayName,
      title: draft.title,
      body: draft.body,
      dataSnapshot: data as unknown as Prisma.InputJsonValue,
      citedFacts: draft.citedFacts as unknown as Prisma.InputJsonValue,
    },
  });

  return "published";
}
