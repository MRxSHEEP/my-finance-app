import { valueMatchesPool } from "@/lib/generatedNews/factPools";
import type { ReportNarrativeContext } from "@/lib/reportNarrative/types";

export { valueMatchesPool };

// Same closed-vocabulary fact-pool technique as
// lib/generatedNews/factPools.ts, applied to this feature's own context
// shape — the prompt (generate.ts) tells Claude which of these fields have
// real data available, and the fact-check validates every CITED_FACTS line
// against the real pool for its field. A cited value with no match in its
// field's pool means the model stated a number that isn't actually in the
// data it was given.
export type FactPools = Record<string, number[]>;

function nonNull(values: Array<number | null | undefined>): number[] {
  return values.filter((v): v is number => v !== null && v !== undefined);
}

export function buildReportNarrativeFactPools(context: ReportNarrativeContext): FactPools {
  const pools: FactPools = {};
  pools.totalValue = [context.totalValue];

  const holdingValues: number[] = [];
  const percentValues: number[] = [];
  const gainLossValues: number[] = [];
  const latestCloseValues: number[] = [];
  const earningsSurpriseValues: number[] = [];

  for (const h of context.simulatedHoldings ?? []) {
    holdingValues.push(h.currentValue);
    percentValues.push(h.percentOfPortfolio);
    if (h.unrealizedGainLossPercent !== null) gainLossValues.push(h.unrealizedGainLossPercent);
    if (h.freshData?.latestClose !== null && h.freshData?.latestClose !== undefined) latestCloseValues.push(h.freshData.latestClose);
    if (h.freshData?.lastEarningsSurprisePercent !== null && h.freshData?.lastEarningsSurprisePercent !== undefined) {
      earningsSurpriseValues.push(h.freshData.lastEarningsSurprisePercent);
    }
  }

  for (const h of context.manualHoldings ?? []) {
    holdingValues.push(h.value);
    percentValues.push(h.percentOfPortfolio);
  }

  if (holdingValues.length > 0) pools.holdingValue = nonNull(holdingValues);
  if (percentValues.length > 0) pools.percentOfPortfolio = nonNull(percentValues);
  if (gainLossValues.length > 0) pools.unrealizedGainLossPercent = gainLossValues;
  if (latestCloseValues.length > 0) pools.latestClose = latestCloseValues;
  if (earningsSurpriseValues.length > 0) pools.earningsSurprise = earningsSurpriseValues;

  return pools;
}

export const REPORT_FACT_FIELD_LABELS: Record<string, string> = {
  totalValue: "the portfolio's total value",
  holdingValue: "a holding's current dollar value",
  percentOfPortfolio: "a holding's percent of the total portfolio",
  unrealizedGainLossPercent: "a holding's unrealized gain/loss percentage",
  latestClose: "a holding's latest closing/spot price",
  earningsSurprise: "a holding's last earnings surprise percentage",
};
