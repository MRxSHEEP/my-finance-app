import type { CitedFacts } from "@/lib/generatedNews/types";
import { type FactPools, valueMatchesPool } from "@/lib/reportNarrative/factPools";

export interface FactCheckResult {
  ok: boolean;
  failures: string[];
}

// Same check as lib/generatedNews/factCheck.ts's factCheckArticle, applied
// to this feature's own fact pools — a citation naming a field this
// portfolio's context never had, or a value with no match in that field's
// real pool, both fail the whole narrative. See generate.ts, which never
// returns a narrative that fails this (or the strategy-language guard)
// check — the caller's existing "AI commentary is unavailable" fallback
// covers this exactly like any other generation failure.
export function factCheckNarrative(pools: FactPools, citedFacts: CitedFacts): FactCheckResult {
  const failures: string[] = [];

  for (const [field, value] of Object.entries(citedFacts)) {
    const pool = pools[field];
    if (!pool) {
      failures.push(`cited unavailable field "${field}" (value ${value})`);
      continue;
    }
    if (!valueMatchesPool(value, pool)) {
      failures.push(`cited ${field}=${value}, no match in real data (${pool.join(", ")})`);
    }
  }

  return { ok: failures.length === 0, failures };
}
