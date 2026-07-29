import { prisma } from "@/lib/prisma";
import type { NewsArticle, NewsCategory } from "@/lib/newsApi";
import type { GeneratedNewsAssetType } from "@/lib/generatedNews/types";

const ASSET_TYPE_TO_CATEGORY: Record<GeneratedNewsAssetType, NewsCategory> = {
  stock: "Stocks",
  crypto: "Crypto",
  commodity: "Commodities",
};

// A short, non-AI-generated-sounding teaser for the card view — the full
// disclaimer/attribution lives on the article's own detail page
// (app/news/generated/[id]/page.tsx), not here.
const TEASER_LENGTH = 160;

function toTeaser(body: string): string {
  const collapsed = body.replace(/\s+/g, " ").trim();
  if (collapsed.length <= TEASER_LENGTH) return collapsed;
  return `${collapsed.slice(0, TEASER_LENGTH).trimEnd()}…`;
}

interface GeneratedRow {
  id: string;
  assetType: string;
  title: string;
  body: string;
  generatedAt: Date;
}

function toNewsArticle(row: GeneratedRow): NewsArticle {
  return {
    title: row.title,
    description: toTeaser(row.body),
    source: "Noble Generated News",
    publishedAt: row.generatedAt.toISOString(),
    // Internal detail page, not an external link — real articles link out
    // via ArticleCard's <a target="_blank">; this one needs to host the
    // mandatory disclaimer, so it stays in-app.
    url: `/news/generated/${row.id}`,
    imageUrl: null,
    category: ASSET_TYPE_TO_CATEGORY[row.assetType as GeneratedNewsAssetType],
    isAiGenerated: true,
  };
}

// Every currently-published Noble Generated News article for one
// asset-type category (or all of them, if omitted), newest first.
export async function fetchGeneratedArticles(assetType?: GeneratedNewsAssetType): Promise<NewsArticle[]> {
  const rows = await prisma.generatedNewsArticle.findMany({
    where: assetType ? { assetType } : undefined,
    orderBy: { generatedAt: "desc" },
  });
  return rows.map(toNewsArticle);
}

export async function fetchGeneratedArticleForTicker(assetType: GeneratedNewsAssetType, ticker: string): Promise<NewsArticle | null> {
  const row = await prisma.generatedNewsArticle.findUnique({ where: { assetType_ticker: { assetType, ticker } } });
  return row ? toNewsArticle(row) : null;
}

// A feed route with a hard result cap (RESULT_COUNT in
// app/api/stock|crypto/news, ROLLING_ARTICLE_CAP in
// app/api/commodities/news) could otherwise push a genuinely-published but
// comparatively old generated article out of `sortedPool`'s top `cap`
// entries — real articles refresh far more often than the 24h generated-
// article freshness window, so this isn't a hypothetical. Guarantees "at
// least one Noble Generated News article appears in this section" (an
// explicit requirement) without disturbing normal recency ordering for
// everything else: only swaps the LAST slot, and only when nothing in the
// natural top `cap` was already AI-generated.
export function withGuaranteedGeneratedArticle(sortedPool: NewsArticle[], cap: number): NewsArticle[] {
  const top = sortedPool.slice(0, cap);
  if (cap <= 0 || top.some((a) => a.isAiGenerated)) return top;

  const generated = sortedPool.find((a) => a.isAiGenerated);
  if (!generated) return top;

  return [...top.slice(0, cap - 1), generated];
}
