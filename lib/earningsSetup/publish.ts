import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { gatherEarningsSetupData } from "@/lib/earningsSetup/gather";
import { generateEarningsSetupAnalysis } from "@/lib/earningsSetup/generate";
import { factCheckAnalysis } from "@/lib/earningsSetup/factCheck";
import { checkStrategyLanguage } from "@/lib/earningsSetup/strategyGuard";
import type { EarningsSetupDataSnapshot } from "@/lib/earningsSetup/types";

export type EnsureAnalysisStatus =
  | "cached"
  | "generated"
  | "skipped_generation_failed"
  | "skipped_fact_check_failed"
  | "skipped_strategy_violation";

export interface EnsureAnalysisResult {
  status: EnsureAnalysisStatus;
  data: EarningsSetupDataSnapshot;
  narrative: string | null;
}

// A past earnings event's data is a frozen, point-in-time snapshot — once
// generated and stored, it's never regenerated (unlike GeneratedNewsArticle's
// refresh-on-a-cadence model). A failed generation/fact-check/strategy-check
// simply isn't stored at all, so the very next view (not a scheduled retry —
// this feature has no cron, it's purely reactive to a user opening a
// specific earnings event's modal) tries again from scratch. The structured
// data itself is always returned regardless of whether the narrative
// passed, since it's rendered directly from real numbers with no LLM
// involvement at all.
export async function ensureEarningsSetupAnalysis(
  ticker: string,
  companyName: string,
  reportDateIso: string,
  origin: string
): Promise<EnsureAnalysisResult> {
  const reportDate = new Date(`${reportDateIso}T00:00:00Z`);

  const existing = await prisma.earningsSetupAnalysis.findUnique({
    where: { ticker_reportDate: { ticker, reportDate } },
  });
  if (existing) {
    return {
      status: "cached",
      data: existing.dataSnapshot as unknown as EarningsSetupDataSnapshot,
      narrative: existing.narrative,
    };
  }

  const data = await gatherEarningsSetupData(ticker, companyName, reportDateIso, origin);

  const draft = await generateEarningsSetupAnalysis(data);
  if (!draft) return { status: "skipped_generation_failed", data, narrative: null };

  const strategyResult = checkStrategyLanguage(draft.narrative);
  if (!strategyResult.ok) {
    console.error(
      `[earningsSetup] strategy-language violation for ${ticker} ${reportDateIso}: matched "${strategyResult.matchedTerms.join(", ")}" — narrative withheld`
    );
    return { status: "skipped_strategy_violation", data, narrative: null };
  }

  const factCheck = factCheckAnalysis(data, draft.citedFacts);
  if (!factCheck.ok) {
    console.error(`[earningsSetup] fact-check failed for ${ticker} ${reportDateIso} — ${factCheck.failures.join("; ")}`);
    return { status: "skipped_fact_check_failed", data, narrative: null };
  }

  await prisma.earningsSetupAnalysis.upsert({
    where: { ticker_reportDate: { ticker, reportDate } },
    update: {
      dataSnapshot: data as unknown as Prisma.InputJsonValue,
      citedFacts: draft.citedFacts as unknown as Prisma.InputJsonValue,
      narrative: draft.narrative,
    },
    create: {
      ticker,
      reportDate,
      dataSnapshot: data as unknown as Prisma.InputJsonValue,
      citedFacts: draft.citedFacts as unknown as Prisma.InputJsonValue,
      narrative: draft.narrative,
    },
  });

  return { status: "generated", data, narrative: draft.narrative };
}
