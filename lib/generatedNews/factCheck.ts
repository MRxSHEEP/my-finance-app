import { buildFactPools, valueMatchesPool } from "@/lib/generatedNews/factPools";
import type { CitedFacts, GeneratedNewsDataSnapshot } from "@/lib/generatedNews/types";

export interface FactCheckResult {
  ok: boolean;
  failures: string[];
}

// Validates every CITED_FACTS line Claude returned against the real,
// fed-in data snapshot — the automated fact-consistency check: "checks
// whether numbers/claims in the generated article text match the actual
// data it was given." A citation naming a field this ticker's snapshot
// never had (an invented data category — e.g. an "analystRating" citation
// for a crypto asset) or a value that doesn't match any real value for
// that field (an invented/wrong number) both fail the whole article. See
// lib/generatedNews/publish.ts, which never persists/publishes anything
// that fails this check — it's logged and left for the next scheduled run
// to retry instead.
export function factCheckArticle(data: GeneratedNewsDataSnapshot, citedFacts: CitedFacts): FactCheckResult {
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
