// A mechanical, code-level safety net independent of the prompt's own
// instructions — the same "defense in depth" reasoning
// lib/earningsSetup/factCheck.ts applies to numeric claims, applied here
// to forbidden strategy/action language. The prompt already instructs
// Claude never to suggest a specific options strategy or trade direction;
// this scans its actual output for exactly that anyway, since a prompt
// instruction alone is never a guarantee. Any match fails the whole
// narrative — it is never partially redacted and shown, only withheld
// entirely (see lib/earningsSetup/publish.ts).
const FORBIDDEN_TERMS = [
  "buy call",
  "buy calls",
  "sell call",
  "sell calls",
  "buy put",
  "buy puts",
  "sell put",
  "sell puts",
  "covered call",
  "cash-secured put",
  "cash secured put",
  "protective put",
  "straddle",
  "strangle",
  "iron condor",
  "iron butterfly",
  "credit spread",
  "debit spread",
  "calendar spread",
  "bull spread",
  "bear spread",
  "vertical spread",
  "long call",
  "long put",
  "short call",
  "short put",
  "you should buy",
  "you should sell",
  "you should short",
  "consider buying",
  "consider selling",
  "recommend buying",
  "recommend selling",
  "a good entry point",
  "a good entry",
  "buy the dip",
];

export interface StrategyGuardResult {
  ok: boolean;
  matchedTerms: string[];
}

export function checkStrategyLanguage(text: string): StrategyGuardResult {
  const lower = text.toLowerCase();
  const matchedTerms = FORBIDDEN_TERMS.filter((term) => lower.includes(term));
  return { ok: matchedTerms.length === 0, matchedTerms };
}
