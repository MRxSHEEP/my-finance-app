"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { User, Building2 } from "lucide-react";
import type { AudienceMode } from "@/lib/audienceMode";

interface AudienceModeChipProps {
  mode: AudienceMode;
  switchable: boolean;
}

// Two peer color treatments, same structure/intensity for both — neither
// mode reads as "more" than the other. Blue/teal specifically: every other
// hue already carries a single, different meaning elsewhere in this app
// (indigo = type/tag/simulated pills, purple = stock-catalog accent, amber
// = the watchlist star — see lib/cardStyles.ts's own comment warning against
// reusing those), green/red are reserved for gains/losses, and gold is the
// brand/crown color. Blue and teal are the closest pair left that's still
// cool-toned and unclaimed; the icon+label swap alongside this is what
// actually carries the distinction color-alone shouldn't be relied on for.
const MODE_STYLES: Record<AudienceMode, { resting: string; hover: string }> = {
  retail: {
    resting: "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:border-blue-400/30 dark:bg-blue-400/10 dark:text-blue-300",
    hover:
      "hover:border-blue-500/50 hover:bg-blue-500/15 hover:text-blue-800 dark:hover:border-blue-400/50 dark:hover:bg-blue-400/15 dark:hover:text-blue-200",
  },
  advisor: {
    resting: "border-teal-500/30 bg-teal-500/10 text-teal-700 dark:border-teal-400/30 dark:bg-teal-400/10 dark:text-teal-300",
    hover:
      "hover:border-teal-500/50 hover:bg-teal-500/15 hover:text-teal-800 dark:hover:border-teal-400/50 dark:hover:bg-teal-400/15 dark:hover:text-teal-200",
  },
};

// Sits in the header at all times, next to AccountMenu/Sign-in — has to
// hold up with no avatar beside it, since it's visible signed out too
// (see components/AccountMenu.tsx's signed-out state, a plain "Sign In"
// text link). Icon-only below sm to protect header space; icon+label above
// it. One click/tap toggles directly — no dropdown, no confirmation step.
export default function AudienceModeChip({ mode, switchable }: AudienceModeChipProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const Icon = mode === "advisor" ? Building2 : User;
  const label = mode === "advisor" ? "Advisor" : "Retail";

  if (!switchable) {
    // An org member's mode is a fixed fact of their account, not a
    // preference — see lib/audienceMode.ts's ResolvedAudienceMode.switchable
    // comment. No onClick at all, rather than a click that would silently
    // revert on the next render.
    return (
      <span
        key={mode}
        title="Your organization uses advisor mode"
        className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs font-medium animate-chip-mode-in motion-reduce:animate-none sm:px-3 ${MODE_STYLES[mode].resting}`}
      >
        <Icon size={14} />
        <span className="hidden sm:inline">{label}</span>
      </span>
    );
  }

  async function toggle() {
    const next: AudienceMode = mode === "advisor" ? "retail" : "advisor";
    setPending(true);
    try {
      await fetch("/api/audience-mode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: next }),
      });
    } finally {
      // No router.push() — this is a peer, reversible view toggle, not the
      // one-time picker's onboarding choice (see AudienceModePicker.tsx,
      // which still does navigate). Forcing a navigation on every toggle
      // used to route straight into /advisors, the one page whose chip is
      // deliberately non-interactive — refresh() alone re-resolves the mode
      // from app/layout.tsx server-side and switches in place, wherever the
      // visitor already is.
      router.refresh();
    }
  }

  return (
    <button
      key={mode}
      type="button"
      onClick={toggle}
      disabled={pending}
      title={`Switch to ${mode === "advisor" ? "retail" : "advisor"} mode`}
      className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs font-medium transition-colors active:scale-95 disabled:opacity-50 animate-chip-mode-in motion-reduce:animate-none sm:px-3 ${MODE_STYLES[mode].resting} ${MODE_STYLES[mode].hover}`}
    >
      <Icon size={14} />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
