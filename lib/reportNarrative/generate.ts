import Anthropic from "@anthropic-ai/sdk";
import { formatCurrency, formatPercent } from "@/lib/format";
import type { ReportNarrativeContext, SimulatedHoldingContext } from "@/lib/reportNarrative/types";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

// Condenses one holding's data into a few lines — an existing /signals
// verdict (when one exists) is cited alongside the same underlying
// technical/earnings/news data points a fresh gather would have surfaced,
// never in place of them, so the model always sees what actually drove
// that verdict rather than taking it on faith.
function describeHolding(h: SimulatedHoldingContext): string {
  const header = `${h.ticker}${h.companyName ? ` (${h.companyName})` : ""} — ${formatCurrency(h.currentValue)}, ${formatPercent(h.percentOfPortfolio)} of portfolio${
    h.unrealizedGainLossPercent !== null ? `, unrealized ${h.unrealizedGainLossPercent >= 0 ? "+" : ""}${h.unrealizedGainLossPercent.toFixed(1)}% since cost basis` : ""
  }${h.assetType !== "stock" ? ` [${h.assetType}]` : ""}`;

  const lines = [header];

  if (h.existingSignal) {
    lines.push(
      `  Existing /signals rating: ${h.existingSignal.direction} (confidence ${h.existingSignal.confidence}/100), generated ${formatDate(h.existingSignal.generatedAt)} — "${h.existingSignal.rationale}"`
    );
  }

  if (h.freshData) {
    const d = h.freshData;
    const dataLines: string[] = [];
    if (d.latestClose !== null) dataLines.push(`latest close $${d.latestClose.toFixed(2)}${d.smaTrend ? ` (${d.smaTrend} its 50-day average)` : ""}`);
    if (d.nextEarningsDate) dataLines.push(`next earnings ${d.nextEarningsDate}`);
    if (d.lastEarningsSurprisePercent !== null) dataLines.push(`last earnings surprise ${d.lastEarningsSurprisePercent >= 0 ? "+" : ""}${d.lastEarningsSurprisePercent.toFixed(1)}%`);
    if (d.topNewsHeadline) dataLines.push(`recent headline: "${d.topNewsHeadline}"`);
    if (dataLines.length > 0) lines.push(`  Market data: ${dataLines.join("; ")}`);
  }

  if (!h.existingSignal && !h.freshData) {
    lines.push(`  (no additional market data available for this holding)`);
  }

  return lines.join("\n");
}

// Renders the gathered context into the exact data points the model may
// reason about, and asks for a fixed, labeled-response format so it can
// be reliably parsed (see parseNarrative below) — same technique as
// lib/signals/generate.ts's buildPrompt/parseSignalResponse.
function buildPrompt(context: ReportNarrativeContext): string {
  const { clientName, totalValue, simulatedHoldings, manualHoldings } = context;

  if (manualHoldings) {
    const rows = manualHoldings.map((h) => `- ${h.label}: ${formatCurrency(h.value)} (${formatPercent(h.percentOfPortfolio)} of portfolio)`).join("\n");

    return `A financial advisor is drafting a client report for ${clientName}, whose portfolio (total ${formatCurrency(totalValue)}) is entered as manually-tracked holdings with no linked market data:

${rows}

Respond in exactly this format and nothing else — no preamble, no markdown formatting, no extra commentary:

NARRATIVE: <2-3 sentence plain-language paragraph about this portfolio's composition and concentration only>

Rules:
- Only reference the holdings and values listed above. Do not invent performance figures, price movements, or market events — no market data was provided for these holdings, so do not describe any.
- Do not phrase this as personalized investment advice ("you should..."); describe the portfolio's makeup instead.`;
  }

  const holdings = simulatedHoldings ?? [];
  const holdingLines = holdings.length > 0 ? holdings.map(describeHolding).join("\n") : "(no holdings)";

  return `A financial advisor is drafting a client report for ${clientName}, whose portfolio (total ${formatCurrency(totalValue)}) holds:

${holdingLines}

Write a plain-language narrative section explaining this portfolio's recent performance, using ONLY the data above.

Respond in exactly this format and nothing else — no preamble, no markdown formatting, no extra commentary:

NARRATIVE: <2-4 sentence plain-language paragraph, explicitly grounded in the specific data points above>

Rules:
- Only reference holdings, values, and data points explicitly listed above. Do not invent prices, performance figures, earnings results, news events, or market/economic commentary not provided.
- If a holding has no market data listed, do not describe its recent performance — you may still mention it as part of the portfolio's composition.
- This is a draft for a human advisor to review, edit, or discard before it reaches any client — not a final document. Do not phrase it as personalized investment advice ("you should buy/sell/hold..."); describe what the data indicates instead.`;
}

const MARKER = "NARRATIVE:";

// Same marker-scanning parse technique as every other Anthropic call in
// this app (see lib/signals/generate.ts's parseSignalResponse) — returns
// null (never a guessed/defaulted narrative) if the response doesn't
// match the requested shape.
function parseNarrative(raw: string): string | null {
  const index = raw.indexOf(MARKER);
  if (index === -1) return null;
  const narrative = raw.slice(index + MARKER.length).trim();
  return narrative || null;
}

// Never throws — any failure (missing key, network, malformed response)
// resolves to null so the caller can surface a clean "unavailable" state.
// Same graceful-degradation shape as every other Anthropic call in this
// app (see lib/signals/generate.ts, lib/complianceCopilot/generate.ts).
export async function generateReportNarrative(context: ReportNarrativeContext): Promise<string | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;

  try {
    const anthropic = new Anthropic();
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 500,
      messages: [{ role: "user", content: buildPrompt(context) }],
    });

    const textBlock = message.content.find((block) => block.type === "text");
    const raw = textBlock?.type === "text" ? textBlock.text.trim() : "";
    return raw ? parseNarrative(raw) : null;
  } catch (err) {
    console.error(`[report-narrative] Anthropic request failed: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}
