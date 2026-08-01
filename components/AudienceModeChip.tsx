"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { User, Building2 } from "lucide-react";
import type { AudienceMode } from "@/lib/audienceMode";

interface AudienceModeChipProps {
  mode: AudienceMode;
  switchable: boolean;
}

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
        title="Your organization uses advisor mode"
        className="flex items-center gap-1.5 rounded-full border border-black/10 px-2.5 py-1.5 text-xs font-medium text-foreground/50 dark:border-white/15 sm:px-3"
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
      router.push(next === "advisor" ? "/advisors" : "/");
      router.refresh();
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      title={`Switch to ${mode === "advisor" ? "retail" : "advisor"} mode`}
      className="flex items-center gap-1.5 rounded-full border border-black/10 px-2.5 py-1.5 text-xs font-medium text-foreground/70 transition-colors hover:text-foreground disabled:opacity-50 dark:border-white/15 sm:px-3"
    >
      <Icon size={14} />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
