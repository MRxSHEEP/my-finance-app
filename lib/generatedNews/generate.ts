import Anthropic from "@anthropic-ai/sdk";
import { buildFactPools, FACT_FIELD_LABELS } from "@/lib/generatedNews/factPools";
import type { CitedFacts, GeneratedArticleDraft, GeneratedNewsDataSnapshot } from "@/lib/generatedNews/types";

function formatNumber(value: number | null, digits = 2): string {
  return value === null ? "N/A" : value.toFixed(digits);
}

function formatPercent(value: number | null): string {
  return value === null ? "N/A" : `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

// Renders the gathered snapshot into the exact data points the model may
// reason about, and asks for a fixed, labeled-response format so it can be
// reliably parsed (see parseArticleResponse below) — same technique as
// lib/signals/generate.ts's buildPrompt/parseSignalResponse, extended with
// a CITED_FACTS section (see lib/generatedNews/factCheck.ts) so a failure
// to ground the article in the real data is mechanically detectable before
// anything publishes.
//
// Crucially, ANALYST RATING/EARNINGS/INSIDER/CONGRESS sections are omitted
// entirely (not shown as "not available") for crypto/commodities — those
// categories are structurally inapplicable for a non-equity asset, unlike
// a stock where they might just be temporarily unavailable, and the Rules
// block below explicitly forbids referencing them for those asset types.
function buildPrompt(data: GeneratedNewsDataSnapshot, factPools: Record<string, number[]>): string {
  const { assetType, ticker, displayName, technical, analystRating, earnings, news, insiderActivity, congressActivity } = data;

  const technicalLines = [
    `Latest close/spot: ${technical.latestClose !== null ? `$${formatNumber(technical.latestClose)}` : "N/A"}`,
    `50-day SMA: ${technical.sma50 !== null ? `$${formatNumber(technical.sma50)}` : "N/A"}`,
    `200-day SMA: ${technical.sma200 !== null ? `$${formatNumber(technical.sma200)}` : "N/A"}`,
    `RSI(14): ${technical.rsi14 !== null ? formatNumber(technical.rsi14, 1) : "N/A"}`,
    `Volume trend (recent 10-session avg vs. 60-session baseline): ${formatPercent(technical.volumeTrendPercent)}`,
  ].join("\n");

  const sections: string[] = [`TECHNICAL INDICATORS (computed from real price/volume history):\n${technicalLines}`];

  if (assetType === "stock") {
    const analystLines = analystRating
      ? `Analyst rating: ${analystRating.ratingLabel} (${formatNumber(analystRating.rating, 2)} on a 1-5 scale)${
          analystRating.recommendationBreakdown
            ? ` — Strong Buy ${analystRating.recommendationBreakdown.strongBuy}, Buy ${analystRating.recommendationBreakdown.buy}, Hold ${analystRating.recommendationBreakdown.hold}, Sell ${analystRating.recommendationBreakdown.sell}, Strong Sell ${analystRating.recommendationBreakdown.strongSell}`
            : ""
        }`
      : "Analyst rating: not available";
    sections.push(`ANALYST RATING:\n${analystLines}`);

    const earningsLines = earnings
      ? [
          `Next earnings date: ${earnings.nextEarningsDate ?? "not scheduled/unknown"}`,
          earnings.recentQuarters.length > 0
            ? `Recent quarters:\n${earnings.recentQuarters
                .map(
                  (q) =>
                    `  Q${q.quarter} ${q.year}: actual ${q.actual ?? "N/A"}, estimate ${q.estimate ?? "N/A"}${
                      q.surprisePercent !== null ? `, surprise ${formatPercent(q.surprisePercent)}` : ""
                    }`
                )
                .join("\n")}`
            : "Recent quarters: none reported",
        ].join("\n")
      : "Earnings data: not available";
    sections.push(`EARNINGS:\n${earningsLines}`);
  }

  const newsLines = news.length > 0 ? news.map((n) => `- ${n.title} (${n.source})`).join("\n") : "(no recent headlines found)";
  sections.push(`RECENT NEWS HEADLINES:\n${newsLines}`);

  if (assetType === "stock") {
    const insiderLines =
      insiderActivity.length > 0
        ? insiderActivity
            .map((a) => {
              const amount =
                a.shares !== null && a.exactValue !== null
                  ? ` — ${a.shares.toLocaleString()} shares ($${formatNumber(a.exactValue, 0)})`
                  : "";
              return `- ${a.reportingPersonName ?? "Unknown insider"}: ${a.transactionType} on ${a.reportedDate ?? a.disclosureDate ?? "unknown date"}${amount}`;
            })
            .join("\n")
        : "(no insider Form 4 activity recorded in the tracked window)";
    sections.push(`RECENT INSIDER TRADING (SEC Form 4 disclosures):\n${insiderLines}`);

    const congressLines =
      congressActivity.length > 0
        ? congressActivity
            .map((a) => {
              const amount =
                a.amountLow !== null && a.amountHigh !== null
                  ? ` — $${formatNumber(a.amountLow, 0)}-$${formatNumber(a.amountHigh, 0)} range`
                  : "";
              return `- ${a.entityName}: ${a.transactionType} on ${a.reportedDate ?? a.disclosureDate ?? "unknown date"}${amount}`;
            })
            .join("\n")
        : "(no congressional trading activity recorded in the tracked window)";
    sections.push(`RECENT CONGRESSIONAL TRADING (Periodic Transaction Reports):\n${congressLines}`);
  }

  const assetLabel = assetType === "stock" ? "publicly traded company" : assetType === "crypto" ? "cryptocurrency" : "commodity";
  const availableFactFields = Object.keys(factPools);
  const factFieldList =
    availableFactFields.length > 0
      ? availableFactFields.map((f) => `${f} (${FACT_FIELD_LABELS[f]})`).join(", ")
      : "(none — no numeric figures are available to cite for this article)";

  return `Here is real market data for the ${assetLabel} ${displayName} (${ticker}):

${sections.join("\n\n")}

Write an original, educational news-style article about ${displayName} based strictly on the data above. Respond in exactly this format and nothing else — no preamble, no markdown formatting, no extra commentary:

TITLE: <a single-line headline, no quotes>
BODY: <3-5 short paragraphs of plain-prose article text>
CITED_FACTS:
<zero or more lines, one per specific number you stated in BODY, each in the exact form "field_name: value">

Rules:
- Only reference data explicitly provided above. Do not mention macroeconomic conditions, Fed policy, interest rates, or any broader economic trend — none of that data was provided to you.
- Do not invent statistics, numbers, events, or data categories not listed above. If a category above says data is unavailable/none, do not reference it as if it existed.${
    assetType === "stock"
      ? ""
      : ` This is a ${assetLabel}, not a company — never invent or reference analyst ratings, earnings, price/earnings ratios, insider trading, or congressional trading, since none of that data exists for this asset type.`
  }
- This is educational analysis only, not personalized investment advice — do not phrase it as a recommendation ("you should buy" etc.); describe what the data indicates instead.
- CITED_FACTS: for every specific number you state in BODY (a price, a moving average, an RSI value, a percentage, a dollar amount, a share count, etc.), add one line in the exact format "field_name: value" using ONLY these exact field names, and ONLY the ones with real data available for this asset: ${factFieldList}. Do not cite a field not in that list, and do not restate the same number under more than one field name. If BODY doesn't state any such number, leave CITED_FACTS empty.`;
}

const REQUIRED_MARKERS = ["TITLE:", "BODY:", "CITED_FACTS:"] as const;

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
// marker-scanning technique as lib/signals/generate.ts's
// parseSignalResponse. Returns null (never a guessed/defaulted article) if
// the response doesn't match the requested shape.
function parseArticleResponse(raw: string): GeneratedArticleDraft | null {
  const found = REQUIRED_MARKERS.map((marker) => ({ marker, index: raw.indexOf(marker) })).filter((p) => p.index !== -1);
  if (REQUIRED_MARKERS.some((m) => !found.some((f) => f.marker === m))) return null;

  const sorted = [...found].sort((a, b) => a.index - b.index);
  const values: Record<string, string> = {};
  for (let i = 0; i < sorted.length; i++) {
    const { marker, index } = sorted[i];
    const end = i + 1 < sorted.length ? sorted[i + 1].index : raw.length;
    values[marker] = raw.slice(index + marker.length, end).trim();
  }

  const title = values["TITLE:"];
  const body = values["BODY:"];
  if (!title || !body) return null;

  return { title, body, citedFacts: parseCitedFacts(values["CITED_FACTS:"] ?? "") };
}

// Never throws — any failure (missing key, network, malformed response)
// resolves to null so one ticker's generation failure never blocks the
// rest of a daily ingest run or an on-demand ensure call. Same
// graceful-degradation shape as lib/signals/generate.ts's generateSignal.
export async function generateArticle(data: GeneratedNewsDataSnapshot): Promise<GeneratedArticleDraft | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;

  const factPools = buildFactPools(data);

  try {
    const anthropic = new Anthropic();
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 900,
      messages: [{ role: "user", content: buildPrompt(data, factPools) }],
    });

    const textBlock = message.content.find((block) => block.type === "text");
    const raw = textBlock?.type === "text" ? textBlock.text.trim() : "";
    return raw ? parseArticleResponse(raw) : null;
  } catch (err) {
    console.error(`[generatedNews] Anthropic request failed for ${data.assetType}:${data.ticker}: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}
