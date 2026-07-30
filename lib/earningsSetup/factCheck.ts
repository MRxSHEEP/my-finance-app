import { buildFactPools, valueMatchesPool } from "@/lib/earningsSetup/factPools";
import type { CitedFacts, EarningsSetupDataSnapshot } from "@/lib/earningsSetup/types";

export interface FactCheckResult {
  ok: boolean;
  failures: string[];
}

// Validates every CITED_FACTS line Claude returned against the real,
// fed-in data snapshot — same mechanism as lib/generatedNews/factCheck.ts.
// A citation naming a field this event's snapshot never had, or a value
// that doesn't match any real value for that field, both fail the whole
// narrative — see lib/earningsSetup/publish.ts, which never persists a
// narrative that fails this check (the structured data still shows on its
// own regardless, since that's rendered directly from real numbers with
// no LLM involved).
export function factCheckAnalysis(data: EarningsSetupDataSnapshot, citedFacts: CitedFacts): FactCheckResult {
  const pools = buildFactPools(data);
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
