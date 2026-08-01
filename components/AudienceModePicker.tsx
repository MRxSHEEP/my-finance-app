"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { User, Building2 } from "lucide-react";
import { cardClass } from "@/lib/cardStyles";
import type { AudienceMode } from "@/lib/audienceMode";

// Shown only on "/" for a visitor with no resolved preference at all (see
// hasExplicitAudienceMode / resolveBaseAudienceMode in lib/audienceMode.ts)
// — never a blocking modal (this app has none), just this page's own main
// content for that one render. Deliberately not "institutional investor"
// for the advisor option — that's a regulatory term, and this choice is a
// display preference, not an attestation of anything.
export default function AudienceModePicker() {
  const router = useRouter();
  const [pending, setPending] = useState<AudienceMode | null>(null);

  async function choose(mode: AudienceMode) {
    setPending(mode);
    try {
      await fetch("/api/audience-mode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
    } finally {
      if (mode === "advisor") {
        router.push("/advisors");
      } else {
        router.refresh();
      }
    }
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-10 p-8 text-center">
      <div className="flex flex-col items-center gap-2">
        <h1 className="text-3xl font-bold text-foreground">What brings you to Noble?</h1>
        <p className="text-foreground/60">You can switch this anytime from the header.</p>
      </div>

      <div className="grid w-full max-w-2xl grid-cols-1 gap-4 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => choose("retail")}
          disabled={pending !== null}
          className={cardClass("neutral", {
            interactive: true,
            extra: "flex flex-col items-center gap-3 p-8 text-center disabled:opacity-50",
          })}
        >
          <User size={28} className="text-foreground/70" />
          <span className="text-lg font-semibold text-foreground">Investing for myself</span>
          <span className="text-sm text-foreground/60">
            Track markets, build a watchlist, and paper-trade strategies.
          </span>
        </button>

        <button
          type="button"
          onClick={() => choose("advisor")}
          disabled={pending !== null}
          className={cardClass("neutral", {
            interactive: true,
            extra: "flex flex-col items-center gap-3 p-8 text-center disabled:opacity-50",
          })}
        >
          <Building2 size={28} className="text-foreground/70" />
          <span className="text-lg font-semibold text-foreground">Running an advisory firm</span>
          <span className="text-sm text-foreground/60">
            Compliance, reporting, model portfolios, and peer benchmarking for your team.
          </span>
        </button>
      </div>
    </main>
  );
}
