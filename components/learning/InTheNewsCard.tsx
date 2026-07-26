"use client";

import { useEffect, useState } from "react";
import { Newspaper } from "lucide-react";
import type { NewsArticle } from "@/lib/newsApi";

// Supplementary, not core content — fails silently (renders nothing) on
// error or when no matching article is found, rather than surfacing an
// error state that would compete with the actual lesson.
export default function InTheNewsCard({ topicId }: { topicId: string }) {
  const [article, setArticle] = useState<NewsArticle | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch(`/api/learning/news?topicId=${encodeURIComponent(topicId)}`);
        const body = response.ok ? await response.json().catch(() => null) : null;
        if (!cancelled) setArticle(body?.article ?? null);
      } catch {
        if (!cancelled) setArticle(null);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [topicId]);

  if (article === undefined) {
    return <div className="h-16 w-full animate-pulse rounded-md bg-foreground/10" />;
  }

  if (article === null) return null;

  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-start gap-3 rounded-md border border-black/10 p-3 text-sm transition-colors hover:border-black/30 dark:border-white/15 dark:hover:border-white/30"
    >
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-foreground/10 text-foreground/60">
        <Newspaper size={13} />
      </span>
      <div className="flex flex-col gap-0.5">
        <span className="text-xs font-medium uppercase tracking-wide text-foreground/40">
          In the news
        </span>
        <span className="font-medium leading-snug text-foreground">{article.title}</span>
        <span className="text-xs text-foreground/50">{article.source}</span>
      </div>
    </a>
  );
}
