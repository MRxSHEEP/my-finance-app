"use client";

import { useEffect, useRef, useState } from "react";

interface Suggestion {
  symbol: string;
  description: string;
}

interface TickerAutocompleteInputProps {
  value: string;
  onChange: (value: string) => void;
  onSelect?: (symbol: string, description: string) => void;
  placeholder?: string;
  className?: string;
}

// Extracted from the identical debounced GET /api/stock/suggestions?q=
// pattern already duplicated in app/stocks/page.tsx and
// components/portfolio/SimulatedPortfolioDetailView.tsx — the Compliance
// feature needed a third copy (restricted-list entry, trade disclosure,
// pre-clearance request), which is what justified pulling it out here
// rather than adding a fourth inline copy.
export default function TickerAutocompleteInput({
  value,
  onChange,
  onSelect,
  placeholder = "Ticker symbol",
  className = "",
}: TickerAutocompleteInputProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  // Server-side (validateRealTicker in lib/resolveTicker.ts) is the actual
  // enforcement boundary — this is UI feedback only, so a user typing a
  // real ticker without clicking the dropdown isn't silently surprised by
  // a rejection only at submit time.
  const [unrecognized, setUnrecognized] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const skipNextFetchRef = useRef(false);
  // Tracked outside state so handleBlur can tell, after its async check
  // resolves, whether a since-fired click on a suggestion (handleSelect)
  // already changed the value out from under it — blur fires before click
  // in the browser's own event order, so without this a stale blur check
  // can overwrite the correct post-selection state.
  const latestValueRef = useRef(value);
  useEffect(() => {
    latestValueRef.current = value;
  }, [value]);

  useEffect(() => {
    if (skipNextFetchRef.current) {
      skipNextFetchRef.current = false;
      return;
    }

    // No synchronous reset here for a too-short query — the render guard
    // below (`value.trim().length >= 2`) already hides the dropdown; a
    // stale `suggestions` array sitting unused in state is harmless and
    // avoids a setState-in-effect-body lint violation for no real benefit.
    const query = value.trim();
    if (query.length < 2) return;

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/stock/suggestions?q=${encodeURIComponent(query)}`);
        const body = await res.json().catch(() => null);
        if (cancelled) return;

        if (res.ok && Array.isArray(body?.suggestions)) {
          setSuggestions(body.suggestions);
          setShowSuggestions(body.suggestions.length > 0);
        } else {
          setSuggestions([]);
          setShowSuggestions(false);
        }
      } catch {
        if (!cancelled) {
          setSuggestions([]);
          setShowSuggestions(false);
        }
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [value]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleSelect(suggestion: Suggestion) {
    skipNextFetchRef.current = true;
    setShowSuggestions(false);
    setSuggestions([]);
    setUnrecognized(false);
    onChange(suggestion.symbol);
    onSelect?.(suggestion.symbol, suggestion.description);
  }

  // Not the enforcement boundary (validateRealTicker on the server is) —
  // this only gives feedback before submit, for the common case of a real
  // ticker typed out in full without clicking the dropdown.
  async function handleBlur() {
    const query = value.trim();
    if (!query) return setUnrecognized(false);

    const alreadyMatches = suggestions.some((s) => s.symbol.toUpperCase() === query.toUpperCase());
    if (alreadyMatches) return setUnrecognized(false);

    try {
      const res = await fetch(`/api/stock/suggestions?q=${encodeURIComponent(query)}`);
      const body = await res.json().catch(() => null);
      // A selection (or further typing) may have landed while this was in
      // flight — that path already set its own correct unrecognized state,
      // so don't clobber it with a check for a value that's no longer current.
      if (latestValueRef.current.trim().toUpperCase() !== query.toUpperCase()) return;
      const matches =
        res.ok &&
        Array.isArray(body?.suggestions) &&
        body.suggestions.some((s: Suggestion) => s.symbol?.toUpperCase() === query.toUpperCase());
      setUnrecognized(!matches);
    } catch {
      // Network hiccup — don't flag a real ticker as wrong just because
      // this one extra check failed; the server-side gate at submit time
      // still applies regardless.
      setUnrecognized(false);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => {
          setUnrecognized(false);
          onChange(e.target.value.toUpperCase());
        }}
        onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
        onBlur={handleBlur}
        onKeyDown={(e) => e.key === "Escape" && setShowSuggestions(false)}
        placeholder={placeholder}
        className={
          className ||
          "w-full rounded-md border border-black/10 bg-transparent px-3 py-2 text-sm outline-none transition-colors duration-200 ease-out focus:border-blue-400/50 dark:border-white/15 dark:focus:border-blue-400/50"
        }
      />
      {unrecognized && (
        <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
          &ldquo;{value.trim()}&rdquo; isn&apos;t a recognized ticker symbol — pick one from the suggestions.
        </p>
      )}
      {showSuggestions && suggestions.length > 0 && value.trim().length >= 2 && (
        <ul className="absolute left-0 right-0 top-full z-20 mt-1 max-h-72 overflow-auto rounded-md border border-black/10 bg-background text-sm shadow-lg dark:border-white/15">
          {suggestions.map((s, index) => (
            <li key={`${s.symbol}-${index}`}>
              <button
                type="button"
                onClick={() => handleSelect(s)}
                className="block w-full px-3 py-2 text-left transition-colors duration-150 ease-out hover:bg-foreground/5"
              >
                <span className="font-medium text-foreground">{s.symbol}</span>
                <span className="ml-2 truncate text-foreground/50">{s.description}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
