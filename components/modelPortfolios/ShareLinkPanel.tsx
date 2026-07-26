"use client";

import { useState } from "react";
import { cardClass } from "@/lib/cardStyles";

interface ShareLinkPanelProps {
  modelPortfolioId: string;
  shareLink: { token: string; active: boolean } | null;
  onChanged: () => void;
}

// No confirm() dialog on Regenerate — matches this app's existing
// no-modal-dialogs convention (e.g. TeamManagementPanel.tsx's
// remove-member button acts directly); the button label itself states the
// consequence instead.
export default function ShareLinkPanel({ modelPortfolioId, shareLink, onChanged }: ShareLinkPanelProps) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const shareUrl = shareLink
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/portfolios/models/share/${shareLink.token}`
    : null;

  async function handleGenerate() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/model-portfolios/${modelPortfolioId}/share-link`, { method: "POST" });
      const body = await res.json().catch(() => null);
      if (!res.ok) return setError(body?.error ?? "Failed to generate link");
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function handleToggleActive(active: boolean) {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/model-portfolios/${modelPortfolioId}/share-link`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) return setError(body?.error ?? "Failed to update link");
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  function copyLink() {
    if (!shareUrl) return;
    navigator.clipboard?.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <section className={cardClass("neutral", { extra: "flex flex-col gap-3 p-4" })}>
      <h2 className="text-lg font-semibold text-foreground">Client Share Link</h2>
      <p className="text-xs text-foreground/50">
        Anyone with this link can view this portfolio&apos;s allocation and performance — no sign-in
        required. They cannot see your other portfolios or make any changes.
      </p>

      {!shareLink ? (
        <button
          type="button"
          onClick={handleGenerate}
          disabled={busy}
          className="self-start rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Generating…" : "Generate share link"}
        </button>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={shareUrl ?? ""}
              className="flex-1 rounded-md border border-black/10 bg-transparent px-3 py-2 text-xs text-foreground/70 outline-none dark:border-white/15"
            />
            <button
              type="button"
              onClick={copyLink}
              className="rounded-md border border-black/10 px-2 py-1 text-xs font-medium text-foreground/70 hover:text-foreground dark:border-white/15"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-xs text-foreground/70">
              <input
                type="checkbox"
                checked={shareLink.active}
                disabled={busy}
                onChange={(e) => handleToggleActive(e.target.checked)}
                className="h-3.5 w-3.5 accent-indigo-400"
              />
              {shareLink.active ? "Active" : "Revoked"}
            </label>
            <button
              type="button"
              onClick={handleGenerate}
              disabled={busy}
              className="rounded-md border border-red-500/30 px-2 py-1 text-xs font-medium text-red-500 hover:bg-red-500/10 disabled:opacity-50"
            >
              Regenerate (invalidates the current link)
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-500">{error}</p>}
    </section>
  );
}
