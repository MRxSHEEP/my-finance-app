import Anthropic from "@anthropic-ai/sdk";
import type { ComplianceReview, PreclearanceReviewContext } from "@/lib/complianceCopilot/types";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

// Renders the gathered context into the exact data points the model may
// reason about, and asks for a fixed, labeled-response format so it can
// be reliably parsed (see parseReview below) — same technique as
// lib/signals/generate.ts's buildPrompt/parseSignalResponse.
function buildPrompt(context: PreclearanceReviewContext): string {
  const { request, restrictedListEntry, existingFlags, priorActivitySameTicker } = context;

  const restrictedLine = restrictedListEntry
    ? `RESTRICTED: Yes — added to the restricted list on ${formatDate(restrictedListEntry.addedAt)}.${
        restrictedListEntry.notes ? ` Reason on file: "${restrictedListEntry.notes}"` : " No reason on file."
      }`
    : "RESTRICTED: No — this ticker is not currently on the firm's restricted list.";

  const flagsLines =
    existingFlags.length > 0
      ? existingFlags.map((f) => `- ${f.flagType}: ${JSON.stringify(f.details)}`).join("\n")
      : "(the firm's automatic restricted-list/insider-proximity check raised no flags for this request)";

  const priorLines =
    priorActivitySameTicker.length > 0
      ? priorActivitySameTicker
          .map(
            (a) =>
              `- ${a.source === "trade_disclosure" ? "Disclosed" : "Pre-cleared request"}: ${a.transactionType} of ${a.quantity} shares on ${formatDate(a.date)}${a.status ? ` (${a.status})` : ""}`
          )
          .join("\n")
      : "(no prior activity by this employee in this ticker on record in the last 180 days)";

  return `A compliance officer at a registered investment advisor (RIA) firm is reviewing a pending trade pre-clearance request. Analyze it using ONLY the data below.

REQUEST: ${request.employeeName} wants to ${request.transactionType} ${request.quantity} shares of ${request.ticker}, proposed for ${formatDate(request.proposedTradeDate)}.${
    request.notes ? ` Employee's own note: "${request.notes}"` : ""
  }

RESTRICTED LIST STATUS:
${restrictedLine}

AUTOMATIC FLAGS ALREADY RAISED BY THE FIRM'S SYSTEM FOR THIS REQUEST:
${flagsLines}

THIS EMPLOYEE'S PRIOR ACTIVITY IN THIS SAME TICKER (last 180 days):
${priorLines}

Respond in exactly this format and nothing else — no preamble, no markdown formatting, no extra commentary:

FLAG: <yes or no>
RATIONALE: <2-3 sentences explaining the call, explicitly citing which specific data points above drove it>
SUGGESTED_NOTE: <a concise, professional compliance note a human officer could use as-is or edit before saving to the permanent record>

Rules:
- Only reference the data provided above. Do not invent tickers, dates, amounts, or firm policies not listed.
- This is a draft suggestion for a human compliance officer to review, edit, or reject — not a final determination. Do not phrase the rationale or note as though a decision has already been made ("this trade is approved/denied" etc.) — describe what the data indicates instead.
- If nothing above indicates a concern, answering FLAG: no with a brief, honest rationale saying so is correct and expected — do not manufacture a concern just to seem thorough.`;
}

const MARKERS = ["FLAG:", "RATIONALE:", "SUGGESTED_NOTE:"] as const;

// Same marker-scanning parse technique as lib/signals/generate.ts's
// parseSignalResponse. Returns null (never a guessed/defaulted review) if
// the response doesn't match the requested shape.
function parseReview(raw: string): ComplianceReview | null {
  const positions = MARKERS.map((marker) => ({ marker, index: raw.indexOf(marker) }));
  if (positions.some((p) => p.index === -1)) return null;

  const sorted = [...positions].sort((a, b) => a.index - b.index);
  const values: Record<string, string> = {};
  for (let i = 0; i < sorted.length; i++) {
    const { marker, index } = sorted[i];
    const end = i + 1 < sorted.length ? sorted[i + 1].index : raw.length;
    values[marker] = raw.slice(index + marker.length, end).trim();
  }

  const flagRaw = values["FLAG:"]?.toLowerCase();
  const flag = flagRaw === "yes" ? true : flagRaw === "no" ? false : null;
  const rationale = values["RATIONALE:"];
  const suggestedNote = values["SUGGESTED_NOTE:"];

  if (flag === null || !rationale || !suggestedNote) return null;

  return { flag, rationale, suggestedNote };
}

// Never throws — any failure (missing key, network, malformed response)
// resolves to null so the caller can surface a clean "unavailable" state.
// Same graceful-degradation shape as every other Anthropic call in this
// app (see lib/signals/generate.ts).
export async function generateComplianceReview(context: PreclearanceReviewContext): Promise<ComplianceReview | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;

  try {
    const anthropic = new Anthropic();
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 400,
      messages: [{ role: "user", content: buildPrompt(context) }],
    });

    const textBlock = message.content.find((block) => block.type === "text");
    const raw = textBlock?.type === "text" ? textBlock.text.trim() : "";
    return raw ? parseReview(raw) : null;
  } catch (err) {
    console.error(`[compliance-copilot] Anthropic request failed: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}
