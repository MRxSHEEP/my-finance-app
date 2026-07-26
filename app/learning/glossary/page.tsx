"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Search } from "lucide-react";
import { GLOSSARY, deriveGlossaryUsage } from "@/lib/learning/glossary";
import { COURSES } from "@/lib/learning/courses";

const TOPIC_TITLES: Record<string, string> = Object.fromEntries(COURSES.map((c) => [c.topicId, c.title]));

function GlossaryList() {
  const searchParams = useSearchParams();
  const highlightSlug = searchParams.get("term");
  const [query, setQuery] = useState("");
  const entryRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const usage = useMemo(() => deriveGlossaryUsage(), []);
  const entries = useMemo(
    () => Object.values(GLOSSARY).sort((a, b) => a.term.localeCompare(b.term)),
    []
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter(
      (e) => e.term.toLowerCase().includes(q) || e.definition.toLowerCase().includes(q)
    );
  }, [entries, query]);

  useEffect(() => {
    if (!highlightSlug) return;
    const node = entryRefs.current[highlightSlug];
    node?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlightSlug]);

  return (
    <main className="flex flex-1 flex-col items-center gap-6 p-8 pt-16 pb-20">
      <div className="flex w-full max-w-2xl flex-col items-center gap-3 text-center">
        <h1 className="text-3xl font-bold text-foreground">Glossary</h1>
        <p className="max-w-lg text-sm text-foreground/60">
          Every highlighted term across Noble&apos;s Learning courses, in one searchable reference.
        </p>
      </div>

      <div className="relative w-full max-w-2xl">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-foreground/40" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search terms..."
          className="w-full rounded-md border border-black/10 bg-transparent py-2 pl-9 pr-3 text-sm outline-none focus:border-black/30 dark:border-white/15 dark:focus:border-white/30"
        />
      </div>

      <div className="flex w-full max-w-2xl flex-col gap-3">
        {filtered.length === 0 && (
          <p className="py-8 text-center text-sm text-foreground/50">No terms match &quot;{query}&quot;.</p>
        )}
        {filtered.map((entry) => {
          const topicIds = usage[entry.slug] ?? [];
          const isHighlighted = entry.slug === highlightSlug;
          return (
            <div
              key={entry.slug}
              ref={(node) => {
                entryRefs.current[entry.slug] = node;
              }}
              className={`flex flex-col gap-1.5 rounded-md border p-4 transition-colors ${
                isHighlighted ? "border-amber-400/50 bg-amber-400/5" : "border-black/10 dark:border-white/15"
              }`}
            >
              <h2 className="font-semibold text-foreground">{entry.term}</h2>
              <p className="text-sm leading-relaxed text-foreground/70">{entry.definition}</p>
              {topicIds.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {topicIds.map((topicId) => (
                    <Link
                      key={topicId}
                      href={`/learning/${topicId}`}
                      className="rounded-full bg-foreground/5 px-2 py-0.5 text-[11px] font-medium text-foreground/60 hover:bg-foreground/10 hover:text-foreground"
                    >
                      {TOPIC_TITLES[topicId] ?? topicId}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}

export default function GlossaryPage() {
  return (
    <Suspense fallback={null}>
      <GlossaryList />
    </Suspense>
  );
}
