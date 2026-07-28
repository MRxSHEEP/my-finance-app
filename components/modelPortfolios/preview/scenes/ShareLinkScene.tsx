"use client";

import { useEffect, useState } from "react";
import { cardClass } from "@/lib/cardStyles";
import { DEMO_SHARE_TOKEN } from "@/components/modelPortfolios/preview/sampleData";

const GENERATE_AT_MS = 900;

const DEMO_SHARE_URL = `noble.app/portfolios/models/share/${DEMO_SHARE_TOKEN}`;

// Mirrors ShareLinkPanel.tsx's markup/classes exactly — a scripted
// idle -> generated sequence instead of a real POST to
// /api/model-portfolios/[id]/share-link, same non-live-API convention as
// every scripted scene in the Compliance and Reporting walkthroughs. A
// visitor can also click "Generate share link" themselves to trigger the
// same transition immediately.
export default function ShareLinkScene() {
  const [generated, setGenerated] = useState(false);
  const [active, setActive] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setGenerated(true), GENERATE_AT_MS);
    return () => clearTimeout(timer);
  }, []);

  return (
    <section className={cardClass("neutral", { extra: "flex flex-col gap-3 p-4 text-left" })}>
      <h2 className="text-lg font-semibold text-foreground">Client Share Link</h2>
      <p className="text-xs text-foreground/50">
        Anyone with this link can view this portfolio&apos;s allocation and performance — no sign-in required. They
        cannot see other portfolios or make any changes.
      </p>

      {!generated ? (
        <button
          type="button"
          onClick={() => setGenerated(true)}
          className="self-start rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90"
        >
          Generate share link
        </button>
      ) : (
        <div className="flex flex-col gap-2 animate-nav-item-fade-in motion-reduce:animate-none">
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={DEMO_SHARE_URL}
              className="flex-1 rounded-md border border-black/10 bg-transparent px-3 py-2 text-xs text-foreground/70 outline-none dark:border-white/15"
            />
            <button
              type="button"
              onClick={() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className="rounded-md border border-black/10 px-2 py-1 text-xs font-medium text-foreground/70 hover:text-foreground dark:border-white/15"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-xs text-foreground/70">
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
                className="h-3.5 w-3.5 accent-indigo-400"
              />
              {active ? "Active" : "Revoked"}
            </label>
            <span className="rounded-md border border-red-500/30 px-2 py-1 text-xs font-medium text-red-500">
              Regenerate (invalidates the current link)
            </span>
          </div>
        </div>
      )}
    </section>
  );
}
