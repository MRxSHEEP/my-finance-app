import Anthropic from "@anthropic-ai/sdk";
import { formatCurrency, formatPercent } from "@/lib/format";
import type { ReportNarrativeContext, SimulatedHoldingContext } from "@/lib/reportNarrative/types";
import type { CitedFacts } from "@/lib/generatedNews/types";
import { checkStrategyLanguage } from "@/lib/earningsSetup/strategyGuard";
import { buildReportNarrativeFactPools, REPORT_FACT_FIELD_LABELS, type FactPools } from "@/lib/reportNarrative/factPools";
import { factCheckNarrative } from "@/lib/reportNarrative/factCheck";

// Condenses one holding's data into a few lines of purely factual market
// data — deliberately never cites an existing /signals verdict's own
// direction/confidence/rationale (see the comment on
// SimulatedHoldingContext.freshData in types.ts for why: this feature drafts
// portfolio-performance commentary, not investment calls).
function describeHolding(h: SimulatedHoldingContext): string {
  const header = `${h.ticker}${h.companyName ? ` (${h.companyName})` : ""} — ${formatCurrency(h.currentValue)}, ${formatPercent(h.percentOfPortfolio)} of portfolio${
    h.unrealizedGainLossPercent !== null ? `, unrealized ${h.unrealizedGainLossPercent >= 0 ? "+" : ""}${h.unrealizedGainLossPercent.toFixed(1)}% since cost basis` : ""
  }${h.assetType !== "stock" ? ` [${h.assetType}]` : ""}`;

  const lines = [header];

  if (h.freshData) {
    const d = h.freshData;
    const dataLines: string[] = [];
    if (d.latestClose !== null) dataLines.push(`latest close $${d.latestClose.toFixed(2)}${d.smaTrend ? ` (${d.smaTrend} its 50-day average)` : ""}`);
    if (d.nextEarningsDate) dataLines.push(`next earnings ${d.nextEarningsDate}`);
    if (d.lastEarningsSurprisePercent !== null) dataLines.push(`last earnings surprise ${d.lastEarningsSurprisePercent >= 0 ? "+" : ""}${d.lastEarningsSurprisePercent.toFixed(1)}%`);
    if (d.topNewsHeadline) dataLines.push(`recent headline: "${d.topNewsHeadline}"`);
    if (dataLines.length > 0) lines.push(`  Market data: ${dataLines.join("; ")}`);
  } else {
    lines.push(`  (no additional market data available for this holding)`);
  }

  return lines.join("\n");
}

// Renders the gathered context into the exact data points the model may
// reason about, and asks for a fixed, labeled-response format so it can
// be reliably parsed (see parseNarrativeResponse below) — same technique as
// lib/signals/generate.ts's buildPrompt/parseSignalResponse, extended with
// a CITED_FACTS section (see lib/reportNarrative/factCheck.ts) so a
// narrative that isn't actually grounded in the real data is mechanically
// detectable before it's ever shown to the advisor — same reasoning as
// lib/generatedNews/generate.ts's own CITED_FACTS block.
function buildPrompt(context: ReportNarrativeContext, factPools: FactPools): string {
  const { clientName, totalValue, simulatedHoldings, manualHoldings } = context;

  const availableFactFields = Object.keys(factPools);
  const factFieldList =
    availableFactFields.length > 0
      ? availableFactFields.map((f) => `${f} (${REPORT_FACT_FIELD_LABELS[f]})`).join(", ")
      : "(none — no numeric figures are available to cite)";
  const citedFactsInstruction = `- CITED_FACTS: for every specific number you state in NARRATIVE (a dollar value, a percentage, a price, a confidence score, etc.), add one line in the exact format "field_name: value" using ONLY these exact field names, and ONLY the ones with real data available here: ${factFieldList}. Do not cite a field not in that list, and do not restate the same number under more than one field name. If NARRATIVE doesn't state any such number, leave CITED_FACTS empty.`;

  if (manualHoldings) {
    const rows = manualHoldings.map((h) => `- ${h.label}: ${formatCurrency(h.value)} (${formatPercent(h.percentOfPortfolio)} of portfolio)`).join("\n");

    return `A financial advisor is drafting a client report for ${clientName}, whose portfolio (total ${formatCurrency(totalValue)}) is entered as manually-tracked holdings with no linked market data:

${rows}

Respond in exactly this format and nothing else — no preamble, no markdown formatting, no extra commentary:

NARRATIVE: <2-3 sentence plain-language paragraph about this portfolio's composition and concentration only>
CITED_FACTS:
<zero or more lines, one per specific number you stated in NARRATIVE, each in the exact form "field_name: value">

Rules:
- Only reference the holdings and values listed above. Do not invent performance figures, price movements, or market events — no market data was provided for these holdings, so do not describe any.
- Do not phrase this as personalized investment advice ("you should..."); describe the portfolio's makeup instead.
${citedFactsInstruction}`;
  }

  const holdings = simulatedHoldings ?? [];
  const holdingLines = holdings.length > 0 ? holdings.map(describeHolding).join("\n") : "(no holdings)";

  return `A financial advisor is drafting a client report for ${clientName}, whose portfolio (total ${formatCurrency(totalValue)}) holds:

${holdingLines}

Write a plain-language narrative section explaining this portfolio's recent performance, using ONLY the data above.

Respond in exactly this format and nothing else — no preamble, no markdown formatting, no extra commentary:

NARRATIVE: <2-4 sentence plain-language paragraph, explicitly grounded in the specific data points above>
CITED_FACTS:
<zero or more lines, one per specific number you stated in NARRATIVE, each in the exact form "field_name: value">

Rules:
- Only reference holdings, values, and data points explicitly listed above. Do not invent prices, performance figures, earnings results, news events, or market/economic commentary not provided.
- If a holding has no market data listed, do not describe its recent performance — you may still mention it as part of the portfolio's composition.
- This is a draft for a human advisor to review, edit, or discard before it reaches any client — not a final document. Do not phrase it as personalized investment advice ("you should buy/sell/hold..."); describe what the data indicates instead.
${citedFactsInstruction}`;
}

const REQUIRED_MARKERS = ["NARRATIVE:", "CITED_FACTS:"] as const;

function parseCitedFacts(raw: string): CitedFacts {
  const facts: CitedFacts = {};
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const match = trimmed.match(/^([a-zA-Z0-9_]+)\s*:\s*(-?[\d,]*\.?\d+)/);
    if (!match) continue;
    const [, field, valueRaw] = match;
    const value = Number.parseFloat(valueRaw.replace(/,/g, ""));
    if (Number.isFinite(value)) facts[field] = value;
  }
  return facts;
}

// Same marker-scanning parse technique as every other Anthropic call in
// this app (see lib/generatedNews/generate.ts's parseArticleResponse) —
// returns null (never a guessed/defaulted narrative) if the response
// doesn't match the requested shape.
function parseNarrativeResponse(raw: string): { narrative: string; citedFacts: CitedFacts } | null {
  const found = REQUIRED_MARKERS.map((marker) => ({ marker, index: raw.indexOf(marker) })).filter((p) => p.index !== -1);
  if (REQUIRED_MARKERS.some((m) => !found.some((f) => f.marker === m))) return null;

  const sorted = [...found].sort((a, b) => a.index - b.index);
  const values: Record<string, string> = {};
  for (let i = 0; i < sorted.length; i++) {
    const { marker, index } = sorted[i];
    const end = i + 1 < sorted.length ? sorted[i + 1].index : raw.length;
    values[marker] = raw.slice(index + marker.length, end).trim();
  }

  const narrative = values["NARRATIVE:"];
  if (!narrative) return null;

  return { narrative, citedFacts: parseCitedFacts(values["CITED_FACTS:"] ?? "") };
}

// Never throws — any failure (missing key, network, malformed response,
// failed fact-check, or forbidden strategy/trade-direction language)
// resolves to null so the caller can surface a clean "unavailable" state.
// Same graceful-degradation shape as every other Anthropic call in this
// app (see lib/signals/generate.ts, lib/complianceCopilot/generate.ts).
// The fact-check and strategy-guard checks are a mechanical, code-level
// safety net independent of the prompt's own instructions — the prompt
// above already asks Claude to stay grounded in the real data and never
// phrase this as investment advice, but a prompt instruction alone is
// never a guarantee (same reasoning as lib/earningsSetup/strategyGuard.ts
// and lib/generatedNews/factCheck.ts). A narrative that fails either check
// is withheld entirely, never partially redacted and shown.
export async function generateReportNarrative(context: ReportNarrativeContext): Promise<string | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;

  const factPools = buildReportNarrativeFactPools(context);

  try {
    const anthropic = new Anthropic();
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 500,
      messages: [{ role: "user", content: buildPrompt(context, factPools) }],
    });

    const textBlock = message.content.find((block) => block.type === "text");
    const raw = textBlock?.type === "text" ? textBlock.text.trim() : "";
    if (!raw) return null;

    const parsed = parseNarrativeResponse(raw);
    if (!parsed) return null;

    const strategyResult = checkStrategyLanguage(parsed.narrative);
    if (!strategyResult.ok) {
      console.error(`[report-narrative] Discarded narrative for forbidden strategy language: ${strategyResult.matchedTerms.join(", ")}`);
      return null;
    }

    const factCheckResult = factCheckNarrative(factPools, parsed.citedFacts);
    if (!factCheckResult.ok) {
      console.error(`[report-narrative] Discarded narrative for failed fact-check: ${factCheckResult.failures.join("; ")}`);
      return null;
    }

    return parsed.narrative;
  } catch (err) {
    console.error(`[report-narrative] Anthropic request failed: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}
