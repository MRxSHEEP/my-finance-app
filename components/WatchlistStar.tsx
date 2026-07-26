"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Star } from "lucide-react";

interface WatchlistStarProps {
  symbol: string;
  name?: string;
  assetType?: "stock" | "crypto";
  // When the caller already knows whether this symbol is saved (e.g. the
  // Earnings Calendar fetches the user's whole watchlist once at the page
  // level to prioritize watchlisted rows, so it already has the answer
  // for every row up front), passing it here skips this component's own
  // per-instance GET /api/watchlist sync — otherwise rendering many stars
  // at once (one per row) would fire that many redundant full-watchlist
  // fetches. Omit it (the default, `undefined`) to keep the original
  // self-contained behavior for single-star contexts like the stock
  // detail page header.
  initialSaved?: boolean;
}

export default function WatchlistStar({ symbol, name, assetType = "stock", initialSaved }: WatchlistStarProps) {
  const router = useRouter();
  const { status } = useSession();
  const [saved, setSaved] = useState(initialSaved ?? false);
  const [flashToken, setFlashToken] = useState(0);
  const [showPrompt, setShowPrompt] = useState(false);
  const promptRef = useRef<HTMLDivElement>(null);

  // Derived, not stored: it's fully determined by `status`, so tracking
  // it as separate state would just be one more thing to keep in sync.
  const checking = status === "loading";

  // Look up whether this symbol is already saved once we know the auth
  // state — a single GET is cheap here since this page only ever shows
  // one ticker (and therefore one star) at a time. The state updates
  // live inside an async continuation (not synchronously in the effect
  // body) even for the "not authenticated" branch, so a plain logout
  // while this component is mounted still clears a stale `saved: true`.
  // Skipped entirely when the caller already passed `initialSaved` — see
  // the prop's own comment above.
  useEffect(() => {
    if (initialSaved !== undefined) return;
    let cancelled = false;

    async function sync() {
      if (status !== "authenticated") {
        if (!cancelled) setSaved(false);
        return;
      }

      const response = await fetch("/api/watchlist").catch(() => null);
      const body = response?.ok ? await response.json().catch(() => null) : null;
      if (cancelled || !body) return;

      const items: Array<{ symbol: string; assetType?: string }> = Array.isArray(body.items)
        ? body.items
        : [];
      setSaved(items.some((item) => item.symbol === symbol && (item.assetType ?? "stock") === assetType));
    }

    sync();
    return () => {
      cancelled = true;
    };
  }, [symbol, status, assetType, initialSaved]);

  useEffect(() => {
    if (!showPrompt) return;

    function handleClickOutside(event: MouseEvent) {
      if (promptRef.current && !promptRef.current.contains(event.target as Node)) {
        setShowPrompt(false);
      }
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setShowPrompt(false);
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [showPrompt]);

  async function handleClick() {
    if (status !== "authenticated") {
      setShowPrompt((value) => !value);
      return;
    }

    const next = !saved;
    setSaved(next);
    setFlashToken((token) => token + 1);

    try {
      if (next) {
        const response = await fetch("/api/watchlist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ symbol, name, assetType }),
        });
        if (!response.ok) setSaved(false);
      } else {
        const response = await fetch(`/api/watchlist/${encodeURIComponent(symbol)}`, {
          method: "DELETE",
        });
        if (!response.ok) setSaved(true);
      }
    } catch {
      setSaved(!next);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleClick}
        disabled={checking}
        aria-label={saved ? "Remove from watchlist" : "Add to watchlist"}
        aria-pressed={saved}
        className="flex h-11 w-11 items-center justify-center rounded-md border border-black/10 text-foreground/60 transition-all duration-200 ease-out hover:border-black/25 hover:text-foreground active:scale-95 disabled:opacity-50 dark:border-white/15 dark:hover:border-white/30"
      >
        <Star
          key={flashToken}
          size={14}
          className={`animate-star-bounce transition-colors duration-200 ${
            saved ? "fill-amber-400 text-amber-400" : "fill-none"
          }`}
        />
      </button>

      {showPrompt && (
        <div
          ref={promptRef}
          // Centered under the button (rather than anchored to its left or
          // right edge) since this component renders in genuinely
          // different horizontal contexts — near the left edge of the
          // stock page's chart header, but mid-to-right inside an Earnings
          // Calendar row — and a fixed-edge anchor that's safe in one
          // overflows off-screen in the other. max-w clamps it on top of
          // that for the narrowest phone viewports.
          className="absolute left-1/2 top-full z-20 mt-2 w-48 max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-md border border-black/10 bg-background p-3 text-xs shadow-lg dark:border-white/15"
        >
          <p className="mb-2 text-foreground/70">Sign in to save tickers to your watchlist.</p>
          {/* A plain button (not a Link/`<a>`) so this prompt is safe to
              nest inside a caller that's itself a whole-row `<Link>` (e.g.
              the Earnings Calendar's rows) — an anchor here would be
              invalid HTML nested inside another anchor. */}
          <button
            type="button"
            onClick={() => router.push("/login")}
            className="font-medium text-foreground hover:underline"
          >
            Sign in →
          </button>
        </div>
      )}
    </div>
  );
}
