"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { cardClass } from "@/lib/cardStyles";
import { DEMO_AI_COMMENTARY } from "@/components/reporting/preview/sampleData";

// Timeline (ms from mount) for the self-playing sequence — a visitor can
// also short-circuit any step themselves (the draft button, the textarea,
// and Discard all work for real), same interactive-but-self-playing
// spirit as the Compliance walkthrough's PreclearanceScene.
const DRAFTING_AT_MS = 800;
const DRAFTED_AT_MS = 1800;
const EDITED_AT_MS = 3800;
const MANUAL_DRAFT_MS = 1000;

// Mirrors ReportGeneratorForm.tsx's "AI Commentary (optional)" card
// markup/classes exactly, but as a bespoke recreation rather than the real
// component — that card makes a real, authenticated Claude API call when
// "Draft AI Commentary" is clicked (see app/api/reporting/reports/draft-narrative/route.ts),
// which a signed-out visitor could never actually complete. Every state
// change here is local and scripted instead, same convention as the
// Compliance walkthrough's PreclearanceScene.
export default function AiCommentaryScene() {
  const [phase, setPhase] = useState<"idle" | "drafting" | "drafted">("idle");
  const [narrative, setNarrative] = useState("");

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase("drafting"), DRAFTING_AT_MS),
      setTimeout(() => {
        setPhase("drafted");
        setNarrative(DEMO_AI_COMMENTARY.draft);
      }, DRAFTED_AT_MS),
      setTimeout(() => setNarrative(DEMO_AI_COMMENTARY.draft + DEMO_AI_COMMENTARY.editedAddition), EDITED_AT_MS),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  function runDraft() {
    setPhase("drafting");
    setTimeout(() => {
      setPhase("drafted");
      setNarrative(DEMO_AI_COMMENTARY.draft);
    }, MANUAL_DRAFT_MS);
  }

  return (
    <div className={cardClass("neutral", { extra: "flex flex-col gap-3 p-4 text-left" })}>
      <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
        <Sparkles size={15} className="text-indigo-400" />
        AI Commentary (optional)
      </h3>

      <button
        type="button"
        onClick={runDraft}
        disabled={phase === "drafting"}
        className="self-start rounded-md border border-indigo-400/30 px-3 py-1.5 text-xs font-medium text-indigo-400 transition-colors hover:bg-indigo-400/10 disabled:opacity-50"
      >
        {phase === "drafting" ? "Drafting…" : narrative ? "Regenerate draft" : "Draft AI Commentary"}
      </button>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-foreground">Narrative (editable)</span>
        <textarea
          value={narrative}
          onChange={(e) => setNarrative(e.target.value)}
          rows={5}
          placeholder="Click “Draft AI Commentary” to generate a suggested narrative, or write your own here."
          className="w-full rounded-md border border-black/10 bg-transparent px-3 py-2 text-sm outline-none transition-colors duration-200 ease-out focus:border-blue-400/50 dark:border-white/15 dark:focus:border-blue-400/50"
        />
      </label>

      {narrative && (
        <button
          type="button"
          onClick={() => setNarrative("")}
          className="self-start text-xs text-foreground/50 hover:text-foreground hover:underline"
        >
          Discard draft
        </button>
      )}

      <p className="text-[10px] italic text-foreground/40">
        AI-generated draft for review only. Edit or discard as you see fit — only the text left here when the advisor
        clicks &quot;Generate Report&quot; is included, and it will appear in the delivered PDF exactly as written,
        with a disclosure noting it was AI-drafted and advisor-reviewed.
      </p>
    </div>
  );
}
