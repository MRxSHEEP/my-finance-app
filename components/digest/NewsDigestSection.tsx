"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Newspaper } from "lucide-react";
import RevealOnScroll from "@/components/RevealOnScroll";
import { formatRelativeTime } from "@/components/ArticleCard";
import type { Article } from "@/components/NewsTicker";

const HEADLINE_COUNT = 5;

// Reuses the existing general-market news feed as-is — GET /api/news?page=1
// (app/api/news/route.ts), itself built on lib/newsApi.ts's
// fetchAndCleanNewsApi/fetchAndCleanMarketaux/mergeArticleSources and
// lib/newsCache.ts's withCache. No new fetching/dedup logic. Renders with
// this page's own literal dark palette (text-white/white-opacity, matching
// Hero/FeatureCard/TeaserCard above) rather than reusing ArticleCard's
// component directly — that component uses the site-wide `text-foreground`
// token, which flips with the visitor's OS light/dark preference via a
// plain `prefers-color-scheme` media query (confirmed in app/globals.css,
// no `.dark` class involved), and would render near-black text on this
// page's always-dark bg-neutral-950 background for anyone in light mode.
// Only the pure `formatRelativeTime` helper is reused from that file.
export default function NewsDigestSection() {
  const [articles, setArticles] = useState<Article[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch("/api/news?page=1");
        const body = await response.json().catch(() => null);
        if (cancelled) return;
        if (!response.ok || !Array.isArray(body?.articles)) {
          setError(true);
          return;
        }
        setArticles(body.articles.slice(0, HEADLINE_COUNT));
      } catch {
        if (!cancelled) setError(true);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <RevealOnScroll className="flex w-full flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Newspaper size={20} className="text-blue-400" />
          <h2 className="text-2xl font-bold text-white">Top Headlines</h2>
        </div>
        <Link href="/news" className="text-sm text-white/50 hover:text-white/80">
          View all →
        </Link>
      </div>

      <div className="flex flex-col divide-y divide-white/10 rounded-lg border border-white/10 bg-white/[0.02] px-6">
        {articles ? (
          articles.length > 0 ? (
            articles.map((article, index) => (
              <a
                key={`${article.url}-${index}`}
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 py-2.5 text-sm transition-colors duration-150 ease-out hover:bg-white/[0.03]"
              >
                <span className="truncate font-semibold text-white">{article.title}</span>
                <span className="ml-auto shrink-0 whitespace-nowrap text-xs text-white/40">
                  {article.source} · {formatRelativeTime(article.publishedAt)}
                </span>
              </a>
            ))
          ) : (
            <p className="py-6 text-sm text-white/50">No headlines available right now.</p>
          )
        ) : error ? (
          <p className="py-6 text-sm text-white/50">News is temporarily unavailable — check back soon.</p>
        ) : (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="py-2.5">
              <div className="h-4 w-full animate-pulse rounded bg-white/10" />
            </div>
          ))
        )}
      </div>
    </RevealOnScroll>
  );
}
