"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, ArrowRight, Search } from "lucide-react";
import RevealOnScroll from "@/components/RevealOnScroll";
import { GLOSSARY_TERMS } from "@/lib/glossary";

function GlossaryEntry({
  term,
  isOpen,
  onToggle,
}: {
  term: (typeof GLOSSARY_TERMS)[number];
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="border-b border-black/10 py-5 dark:border-white/10">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        className="flex w-full items-start justify-between gap-4 text-left"
      >
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold text-foreground">{term.title}</h2>
          <p className="text-sm text-foreground/60">{term.shortDefinition}</p>
        </div>
        <ChevronDown
          size={18}
          className={`mt-1 shrink-0 text-foreground/50 transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      <div
        className={`grid transition-all duration-300 ease-out ${
          isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          <div className="flex max-w-2xl flex-col gap-3 pt-4 text-[15px] leading-relaxed text-foreground/80">
            {term.content.map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}

            {term.toolHref && (
              <Link
                href={term.toolHref}
                className="mt-1 inline-flex w-fit items-center gap-1.5 rounded-md border border-black/10 px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:border-black/30 dark:border-white/15 dark:hover:border-white/30"
              >
                Try the {term.toolLabel ?? "calculator"}
                <ArrowRight size={14} />
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LearningPage() {
  const [query, setQuery] = useState("");
  const [openSlug, setOpenSlug] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return GLOSSARY_TERMS;
    return GLOSSARY_TERMS.filter((term) => term.title.toLowerCase().includes(trimmed));
  }, [query]);

  return (
    <main className="flex flex-1 flex-col items-center gap-8 p-8 pt-16 pb-20">
      <RevealOnScroll className="flex w-full max-w-2xl flex-col items-center gap-3 text-center">
        <h1 className="text-3xl font-bold text-foreground">Learning</h1>
        <p className="max-w-lg text-sm text-foreground/60">
          Plain-language explanations of the concepts used throughout Noble — search for a term,
          expand it to read more, and jump straight to the matching calculator where one exists.
        </p>
      </RevealOnScroll>

      <RevealOnScroll className="w-full max-w-2xl" delayMs={100}>
        <div className="relative">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-foreground/40" />
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search glossary terms (e.g. P/E, Beta, DCF)"
            className="w-full rounded-md border border-black/10 bg-transparent py-2 pl-9 pr-3 text-sm outline-none focus:border-black/30 dark:border-white/15 dark:focus:border-white/30"
          />
        </div>
      </RevealOnScroll>

      <RevealOnScroll className="w-full max-w-2xl" delayMs={150}>
        {filtered.length === 0 ? (
          <p className="py-8 text-center text-sm text-foreground/60">
            No glossary terms match &quot;{query}&quot;.
          </p>
        ) : (
          <div className="flex flex-col">
            {filtered.map((term) => (
              <GlossaryEntry
                key={term.slug}
                term={term}
                isOpen={openSlug === term.slug}
                onToggle={() => setOpenSlug((current) => (current === term.slug ? null : term.slug))}
              />
            ))}
          </div>
        )}
      </RevealOnScroll>
    </main>
  );
}
