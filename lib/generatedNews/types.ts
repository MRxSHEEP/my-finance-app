// Shared shapes for Noble Generated News (lib/generatedNews/*,
// app/api/generated-news/*). GeneratedNewsDataSnapshot is the exact shape
// stored verbatim in GeneratedNewsArticle.dataSnapshot — reuses /signals'
// own per-field snapshot types (lib/signals/types.ts) rather than a
// parallel copy, since the underlying data categories are identical.
// Stock-only categories (analystRating, earnings, insiderActivity,
// congressActivity) are always null/empty for crypto and commodities —
// the same honest-degradation convention /signals already applies for
// data that genuinely doesn't exist for a given asset type.

import type {
  AnalystRatingSnapshot,
  EarningsSnapshot,
  NewsHeadlineSnapshot,
  TechnicalSnapshot,
  TrackerActivitySnapshot,
} from "@/lib/signals/types";

export type GeneratedNewsAssetType = "stock" | "crypto" | "commodity";

export interface GeneratedNewsDataSnapshot {
  assetType: GeneratedNewsAssetType;
  ticker: string;
  displayName: string;
  technical: TechnicalSnapshot;
  analystRating: AnalystRatingSnapshot | null;
  earnings: EarningsSnapshot | null;
  insiderActivity: TrackerActivitySnapshot[];
  congressActivity: TrackerActivitySnapshot[];
  news: NewsHeadlineSnapshot[];
}

// Claude's own self-reported numeric citations: fieldName -> the value it
// says it used in the article body. Only ever contains fields drawn from
// FACT_FIELD ordering in lib/generatedNews/generate.ts's prompt — anything
// else is rejected wholesale by lib/generatedNews/factCheck.ts.
export type CitedFacts = Record<string, number>;

export interface GeneratedArticleDraft {
  title: string;
  body: string;
  citedFacts: CitedFacts;
}
