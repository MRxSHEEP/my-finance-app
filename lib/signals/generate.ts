import Anthropic from "@anthropic-ai/sdk";
import type { GeneratedSignal, PriceTargetSnapshot, SignalDataSnapshot, SignalDirection } from "@/lib/signals/types";

function formatNumber(value: number | null, digits = 2): string {
  return value === null ? "N/A" : value.toFixed(digits);
}

function formatPercent(value: number | null): string {
  return value === null ? "N/A" : `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

// Renders the gathered snapshot into the exact data points the model may
// reason about, and asks for a fixed, labeled-response format so it can
// be reliably parsed (see parseSignalResponse below) — same technique as
// app/api/daily-briefing/route.ts's buildPrompt/SECTION_MARKERS. Every
// category is always present in the prompt, even when empty, with an
// honest "(none)"/"not available" placeholder — matching daily-briefing's
// own earnings-section precedent — rather than omitting the whole
// category, so the model never has to guess whether a category was
// checked and came up empty vs. never fed to it at all.
function buildPrompt(ticker: string, companyName: string, data: SignalDataSnapshot): string {
  const { technical, analystRating, priceTarget, earnings, news, insiderActivity, congressActivity } = data;

  const technicalLines = [
    `Latest close: ${technical.latestClose !== null ? `$${formatNumber(technical.latestClose)}` : "N/A"}`,
    `50-day SMA: ${technical.sma50 !== null ? `$${formatNumber(technical.sma50)}` : "N/A"}`,
    `200-day SMA: ${technical.sma200 !== null ? `$${formatNumber(technical.sma200)}` : "N/A"}`,
    `RSI(14): ${technical.rsi14 !== null ? formatNumber(technical.rsi14, 1) : "N/A"}`,
    `Volume trend (recent 10-session avg vs. 60-session baseline): ${formatPercent(technical.volumeTrendPercent)}`,
  ].join("\n");

  const analystLines = analystRating
    ? `Analyst rating: ${analystRating.ratingLabel} (${formatNumber(analystRating.rating, 2)} on a 1-5 scale)${
        analystRating.recommendationBreakdown
          ? ` — Strong Buy ${analystRating.recommendationBreakdown.strongBuy}, Buy ${analystRating.recommendationBreakdown.buy}, Hold ${analystRating.recommendationBreakdown.hold}, Sell ${analystRating.recommendationBreakdown.sell}, Strong Sell ${analystRating.recommendationBreakdown.strongSell}`
          : ""
      }`
    : "Analyst rating: not available";

  const priceTargetLine = priceTarget
    ? `Analyst price target: low $${formatNumber(priceTarget.low)}, average $${formatNumber(priceTarget.average)}, high $${formatNumber(priceTarget.high)}`
    : "Analyst price target: not available for this ticker";

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

  const newsLines =
    news.length > 0 ? news.map((n) => `- ${n.title} (${n.source})`).join("\n") : "(no recent headlines found for this ticker)";

  const insiderLines =
    insiderActivity.length > 0
      ? insiderActivity
          .map((a) => {
            const amount = a.shares !== null && a.exactValue !== null ? ` — ${a.shares.toLocaleString()} shares ($${formatNumber(a.exactValue, 0)})` : "";
            return `- ${a.reportingPersonName ?? "Unknown insider"}: ${a.transactionType} on ${a.reportedDate ?? a.disclosureDate ?? "unknown date"}${amount}`;
          })
          .join("\n")
      : "(no insider Form 4 activity recorded in the tracked window)";

  const congressLines =
    congressActivity.length > 0
      ? congressActivity
          .map((a) => {
            const amount =
              a.amountLow !== null && a.amountHigh !== null ? ` — $${formatNumber(a.amountLow, 0)}-$${formatNumber(a.amountHigh, 0)} range` : "";
            return `- ${a.entityName}: ${a.transactionType} on ${a.reportedDate ?? a.disclosureDate ?? "unknown date"}${amount}`;
          })
          .join("\n")
      : "(no congressional trading activity recorded in the tracked window)";

  return `Here is real market data for ${companyName} (${ticker}):

TECHNICAL INDICATORS (computed from real price/volume history):
${technicalLines}

ANALYST RATING:
${analystLines}

${priceTargetLine}

EARNINGS:
${earningsLines}

RECENT NEWS HEADLINES:
${newsLines}

RECENT INSIDER TRADING (SEC Form 4 disclosures):
${insiderLines}

RECENT CONGRESSIONAL TRADING (Periodic Transaction Reports):
${congressLines}

Based strictly on the data above, generate an educational trade signal. Respond in exactly this format and nothing else — no preamble, no markdown formatting, no extra commentary:

DIRECTION: <bullish, neutral, or bearish>
CONFIDENCE: <a single integer from 0 to 100>
RATIONALE: <2-3 sentences explaining the call, explicitly citing which of the specific data points above drove it>${
    priceTarget
      ? ""
      : `
PRICE_TARGET_ESTIMATE: <low>|<average>|<high>`
  }

Rules:
- Only reference data categories explicitly provided above (technical indicators, analyst rating, price target, earnings, news, insider trading, congressional trading). Do not mention macroeconomic conditions, Fed policy, interest rates, or any broader economic trend — none of that data was provided to you.
- Do not invent statistics, numbers, or events not listed above.
- If a category above says data is unavailable/none, do not reference it as if it existed.
- This is educational analysis only, not personalized investment advice — do not phrase the rationale as a recommendation ("you should buy" etc.); describe what the data indicates instead.${
    priceTarget
      ? ""
      : `
- No real analyst price target was provided above, so also include the PRICE_TARGET_ESTIMATE line: your own best-effort low/average/high estimate based only on the data above (technical indicators if available, analyst rating, earnings trend). Plain numbers only (e.g. 145.20|162.50|180.00), no dollar signs. If the data above genuinely isn't enough to form a reasonable estimate, omit that line entirely rather than guessing wildly.`
  }`;
}

const REQUIRED_MARKERS = ["DIRECTION:", "CONFIDENCE:", "RATIONALE:"] as const;
// Only ever asked for (see buildPrompt) when no real price target existed
// — never required, since Claude is explicitly told to omit it rather
// than guess wildly when it can't form a reasonable estimate.
const OPTIONAL_MARKERS = ["PRICE_TARGET_ESTIMATE:"] as const;
const ALL_MARKERS = [...REQUIRED_MARKERS, ...OPTIONAL_MARKERS];

function parsePriceTargetEstimate(raw: string | undefined): PriceTargetSnapshot | null {
  if (!raw) return null;
  const parts = raw.split("|").map((p) => Number.parseFloat(p.trim()));
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return null;
  const [low, average, high] = parts;
  return { low, average, high, isEstimate: true };
}

// Splits Claude's fixed-format response back into its fields — same
// marker-scanning technique as app/api/daily-briefing/route.ts's
// parseSections, extended to tolerate an optional trailing marker that
// may or may not be present. Returns null (never a guessed/defaulted
// signal) if the response doesn't match the requested shape.
function parseSignalResponse(raw: string): GeneratedSignal | null {
  const found = ALL_MARKERS.map((marker) => ({ marker, index: raw.indexOf(marker) })).filter((p) => p.index !== -1);
  if (REQUIRED_MARKERS.some((m) => !found.some((f) => f.marker === m))) return null;

  const sorted = [...found].sort((a, b) => a.index - b.index);
  const values: Record<string, string> = {};
  for (let i = 0; i < sorted.length; i++) {
    const { marker, index } = sorted[i];
    const end = i + 1 < sorted.length ? sorted[i + 1].index : raw.length;
    values[marker] = raw.slice(index + marker.length, end).trim();
  }

  const directionRaw = values["DIRECTION:"]?.toLowerCase();
  const direction: SignalDirection | null =
    directionRaw === "bullish" || directionRaw === "neutral" || directionRaw === "bearish" ? directionRaw : null;

  const confidence = Number.parseInt(values["CONFIDENCE:"] ?? "", 10);
  const rationale = values["RATIONALE:"];

  if (!direction || !rationale || !Number.isFinite(confidence)) return null;

  return {
    direction,
    confidence: Math.min(100, Math.max(0, confidence)),
    rationale,
    estimatedPriceTarget: parsePriceTargetEstimate(values["PRICE_TARGET_ESTIMATE:"]),
  };
}

// Never throws — any failure (missing key, network, malformed response)
// resolves to null so one ticker's generation failure never blocks the
// rest of the daily ingest run. Same graceful-degradation shape as every
// other Anthropic call in this app (see app/api/daily-briefing/route.ts).
export async function generateSignal(ticker: string, companyName: string, data: SignalDataSnapshot): Promise<GeneratedSignal | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;

  try {
    const anthropic = new Anthropic();
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 400,
      messages: [{ role: "user", content: buildPrompt(ticker, companyName, data) }],
    });

    const textBlock = message.content.find((block) => block.type === "text");
    const raw = textBlock?.type === "text" ? textBlock.text.trim() : "";
    return raw ? parseSignalResponse(raw) : null;
  } catch (err) {
    console.error(`[signals] Anthropic request failed for ${ticker}: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}
