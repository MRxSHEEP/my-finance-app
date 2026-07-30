import Anthropic from "@anthropic-ai/sdk";
import { buildFactPools, FACT_FIELD_LABELS } from "@/lib/earningsSetup/factPools";
import type { EarningsSetupDataSnapshot, EarningsSetupDraft, CitedFacts } from "@/lib/earningsSetup/types";

function formatSignedPercent(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function formatMoney(value: number, digits = 2): string {
  return `$${value.toFixed(digits)}`;
}

// Renders the gathered snapshot into the exact data points the model may
// reason about, and asks for a fixed, labeled-response format so it can be
// reliably parsed (see parseAnalysisResponse below) — same marker-scanning
// technique as lib/signals/generate.ts and lib/generatedNews/generate.ts,
// extended with an explicit, absolute ban on options-strategy/trade-
// direction language, since this section is factor presentation only.
function buildPrompt(data: EarningsSetupDataSnapshot, factPools: Record<string, number[]>): string {
  const sections: string[] = [];

  if (data.analystConsensus) {
    const c = data.analystConsensus;
    sections.push(
      `ANALYST CONSENSUS: ${c.ratingLabel} (${c.rating.toFixed(2)} on a 1-5 scale) — Strong Buy ${c.strongBuy}, Buy ${c.buy}, Hold ${c.hold}, Sell ${c.sell}, Strong Sell ${c.strongSell} (${c.totalAnalysts} analysts total, as of ${c.period ?? "an unspecified period"}).`
    );
  } else {
    sections.push("ANALYST CONSENSUS: not available.");
  }

  if (data.priceTarget) {
    sections.push(
      `PRICE TARGET: low ${formatMoney(data.priceTarget.low)}, average ${formatMoney(data.priceTarget.average)}, high ${formatMoney(data.priceTarget.high)} — the average implies ${formatSignedPercent(data.priceTarget.impliedChangePercent)} from the current price of ${data.currentPrice !== null ? formatMoney(data.currentPrice) : "an unavailable current price"}.`
    );
  } else {
    sections.push("PRICE TARGET: not available for this ticker.");
  }

  if (data.recentRevisions.length > 0) {
    sections.push(
      `RECENT ANALYST RATING ACTIONS (upgrades/downgrades only, not maintained ratings):\n${data.recentRevisions
        .map((r) => `- ${r.date}: ${r.gradingCompany} ${r.action}d from ${r.previousGrade} to ${r.newGrade}`)
        .join("\n")}`
    );
  } else {
    sections.push("RECENT ANALYST RATING ACTIONS: none recorded (no upgrades or downgrades on file).");
  }

  if (data.earningsHistory.length > 0) {
    sections.push(
      `RECENT QUARTERLY EARNINGS:\n${data.earningsHistory
        .map((q) => `- Q${q.quarter} ${q.year}: actual ${q.actual ?? "N/A"}, estimate ${q.estimate ?? "N/A"}${q.surprisePercent !== null ? `, surprise ${formatSignedPercent(q.surprisePercent)}` : ""}`)
        .join("\n")}`
    );
  }

  if (data.beatStreak) {
    sections.push(`BEAT/MISS STREAK: beat estimates in ${data.beatStreak.beats} of the last ${data.beatStreak.total} quarters checked.`);
  }

  if (data.priceReaction) {
    sections.push(
      `PRICE REACTION TO THIS REPORT (${data.reportDate}): ${formatSignedPercent(data.priceReaction.reportDayReactionPercent)} on the report day itself, ${formatSignedPercent(data.priceReaction.cumulativeReactionPercent)} cumulative as of the most recent close.`
    );
  } else {
    sections.push("PRICE REACTION TO THIS REPORT: not available.");
  }

  if (data.priorReportReaction) {
    sections.push(
      `PRICE REACTION TO THE PRIOR REPORT (${data.priorReportReaction.reportDate}): ${formatSignedPercent(data.priorReportReaction.reportDayReactionPercent)} on the report day itself, ${formatSignedPercent(data.priorReportReaction.cumulativeReactionPercent)} cumulative.`
    );
  }

  if (data.revenueSegments) {
    sections.push(
      `REVENUE MIX (fiscal year ${data.revenueSegments.fiscalYear} — a full-year figure, NOT specific to the quarter above):\n${data.revenueSegments.segments
        .map((s) => `- ${s.name}: ${s.percentOfTotal.toFixed(1)}% of FY${data.revenueSegments!.fiscalYear} revenue`)
        .join("\n")}`
    );
  }

  if (data.insiderNetSentiment) {
    sections.push(`INSIDER SENTIMENT: ${data.insiderNetSentiment.label} (net ${formatMoney(data.insiderNetSentiment.netValue, 0)} in the tracked window).`);
  }

  if (data.signalDirection) {
    sections.push(`NOBLE SIGNALS: this ticker's own AI trade-signal call is "${data.signalDirection}"${data.signalConfidence !== null ? ` (confidence ${data.signalConfidence}/100)` : ""}.`);
  }

  if (data.divergences.length > 0) {
    sections.push(
      `ALREADY-IDENTIFIED DIVERGENCES (these are established facts, computed from the real data above — you may reference them, but do not invent additional ones):\n${data.divergences.map((d) => `- ${d.description}`).join("\n")}`
    );
  }

  const availableFactFields = Object.keys(factPools);
  const factFieldList =
    availableFactFields.length > 0
      ? availableFactFields.map((f) => `${f} (${FACT_FIELD_LABELS[f]})`).join(", ")
      : "(none — no numeric figures are available to cite)";

  return `Here is real data for ${data.companyName} (${data.ticker})'s earnings report on ${data.reportDate}:

${sections.join("\n\n")}

Write a short, neutral "Earnings Setup Analysis" — factor presentation only, describing what the real data above shows about this earnings event and the context around it. Respond in exactly this format and nothing else — no preamble, no markdown formatting, no extra commentary:

NARRATIVE: <3-5 sentences>
CITED_FACTS:
<zero or more lines, one per specific number you stated in NARRATIVE, each in the exact form "field_name: value">

Absolute rules, non-negotiable:
- This is factor presentation only. NEVER suggest, name, or imply any specific options strategy (e.g. buying/selling calls or puts, straddles, spreads, covered calls) or any specific trade/investment action ("you should buy," "a good entry point," etc.). Describe what the data shows, never what to do about it.
- Only reference data explicitly provided above. Do not invent statistics, numbers, events, or data categories not listed above.
- If a category above says data is unavailable/none, do not reference it as if it existed.
- Do not invent a divergence, tension, or contradiction beyond what is explicitly listed under ALREADY-IDENTIFIED DIVERGENCES above (if that section is absent, do not claim one exists).
- If revenue mix is shown, always describe it as the fiscal year shown, never as belonging to the specific quarter's report.
- CITED_FACTS: for every specific number you state in NARRATIVE, add one line in the exact format "field_name: value" using ONLY these exact field names, and ONLY the ones with real data available: ${factFieldList}. Do not cite a field not in that list.`;
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

// Splits Claude's fixed-format response back into its fields — same
// marker-scanning technique as lib/generatedNews/generate.ts's
// parseArticleResponse. Returns null (never a guessed/defaulted draft) if
// the response doesn't match the requested shape.
function parseAnalysisResponse(raw: string): EarningsSetupDraft | null {
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

// Never throws — any failure (missing key, network, malformed response)
// resolves to null so a missing narrative never blocks the structured
// data (rendered separately, with no LLM involvement) from showing. Same
// graceful-degradation shape as every other Anthropic call in this app.
export async function generateEarningsSetupAnalysis(data: EarningsSetupDataSnapshot): Promise<EarningsSetupDraft | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;

  const factPools = buildFactPools(data);

  try {
    const anthropic = new Anthropic();
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 500,
      messages: [{ role: "user", content: buildPrompt(data, factPools) }],
    });

    const textBlock = message.content.find((block) => block.type === "text");
    const raw = textBlock?.type === "text" ? textBlock.text.trim() : "";
    return raw ? parseAnalysisResponse(raw) : null;
  } catch (err) {
    console.error(`[earningsSetup] Anthropic request failed for ${data.ticker}: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}
