"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { getGlossaryEntry } from "@/lib/learning/glossary";
import { CONCEPT_VISUALS, CONCEPT_COLOR_CLASSES, type ConceptSlug } from "@/lib/conceptVisuals";

// `[[Display Text|slug]]` — authored directly inside courses.ts's plain
// body strings. The `|slug` half is required (not auto-slugified from the
// display text) since several display forms contain characters that make
// auto-slugging unreliable, and the same slug needs to stay reusable
// verbatim across courses (e.g. "free cash flow" appears in both DCF and
// EBITDA content).
const TERM_PATTERN = /\[\[([^\]|]+)\|([^\]]+)\]\]/g;

function GlossaryTermSpan({
  slug,
  displayText,
  topicId,
}: {
  slug: string;
  displayText: string;
  topicId: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const entry = getGlossaryEntry(slug);

  useEffect(() => {
    if (!open) return;

    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  // Missing glossary entry (a typo'd slug) renders as plain text rather
  // than a dead/broken-looking highlight.
  if (!entry) return <>{displayText}</>;

  const color = CONCEPT_VISUALS[topicId as ConceptSlug]?.color ?? "blue";
  const classes = CONCEPT_COLOR_CLASSES[color];

  return (
    <span ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`font-semibold underline decoration-dotted underline-offset-2 ${classes.icon}`}
      >
        {displayText}
      </button>
      {open && (
        <span
          className={`absolute left-0 top-full z-20 mt-1.5 w-64 rounded-md border bg-background p-3 text-left text-xs font-normal normal-case leading-relaxed shadow-lg ${classes.border}`}
        >
          <span className="mb-1 block text-sm font-semibold text-foreground">{entry.term}</span>
          <span className="block text-foreground/70">{entry.definition}</span>
          <Link
            href={`/learning/glossary?term=${slug}`}
            className={`mt-2 inline-block text-xs font-medium hover:underline ${classes.icon}`}
          >
            View in glossary →
          </Link>
        </span>
      )}
    </span>
  );
}

// Renders one paragraph, splitting on the [[term|slug]] markup and
// rendering each match as a highlighted, tappable glossary term colored
// with the current topic's own accent (lib/conceptVisuals.ts) — so a
// course's own vocabulary reads consistently with its identity color
// everywhere else in the app (Learning hub tile, Tools icon, etc.).
export default function HighlightedText({ text, topicId }: { text: string; topicId: string }) {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;
  const pattern = new RegExp(TERM_PATTERN);

  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    const [, displayText, slug] = match;
    parts.push(
      <GlossaryTermSpan key={key++} slug={slug.trim()} displayText={displayText} topicId={topicId} />
    );
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));

  return <>{parts}</>;
}
