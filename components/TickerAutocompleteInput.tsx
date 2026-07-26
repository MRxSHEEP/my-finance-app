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
  const containerRef = useRef<HTMLDivElement>(null);
  const skipNextFetchRef = useRef(false);

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
    onChange(suggestion.symbol);
    onSelect?.(suggestion.symbol, suggestion.description);
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
        onKeyDown={(e) => e.key === "Escape" && setShowSuggestions(false)}
        placeholder={placeholder}
        className={
          className ||
          "w-full rounded-md border border-black/10 bg-transparent px-3 py-2 text-sm outline-none transition-colors duration-200 ease-out focus:border-blue-400/50 dark:border-white/15 dark:focus:border-blue-400/50"
        }
      />
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
