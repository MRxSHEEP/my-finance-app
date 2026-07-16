"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Star } from "lucide-react";

interface WatchlistStarProps {
  symbol: string;
  name?: string;
}

export default function WatchlistStar({ symbol, name }: WatchlistStarProps) {
  const { status } = useSession();
  const [saved, setSaved] = useState(false);
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
  useEffect(() => {
    let cancelled = false;

    async function sync() {
      if (status !== "authenticated") {
        if (!cancelled) setSaved(false);
        return;
      }

      const response = await fetch("/api/watchlist").catch(() => null);
      const body = response?.ok ? await response.json().catch(() => null) : null;
      if (cancelled || !body) return;

      const items: Array<{ symbol: string }> = Array.isArray(body.items) ? body.items : [];
      setSaved(items.some((item) => item.symbol === symbol));
    }

    sync();
    return () => {
      cancelled = true;
    };
  }, [symbol, status]);

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
          body: JSON.stringify({ symbol, name }),
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
        className="rounded-md border border-black/10 p-1.5 text-foreground/60 transition-colors hover:text-foreground disabled:opacity-50 dark:border-white/15"
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
          className="absolute left-0 top-full z-20 mt-2 w-48 rounded-md border border-black/10 bg-background p-3 text-xs shadow-lg dark:border-white/15"
        >
          <p className="mb-2 text-foreground/70">Sign in to save tickers to your watchlist.</p>
          <Link href="/login" className="font-medium text-foreground hover:underline">
            Sign in →
          </Link>
        </div>
      )}
    </div>
  );
}
