"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export type Article = {
  title: string;
  description: string | null;
  source: string;
  publishedAt: string | null;
  url: string;
  imageUrl: string | null;
  category?: "Markets" | "Stocks" | "Crypto" | "Commodities" | "Earnings" | "Economy";
};

const ROTATE_INTERVAL_MS = 5000;
const FADE_DURATION_MS = 300;
const RESUME_AFTER_MS = 8000;

export default function NewsTicker({ articles }: { articles: Article[] }) {
  const [index, setIndex] = useState(0);
  const [fading, setFading] = useState(false);
  const [paused, setPaused] = useState(false);
  const [hovering, setHovering] = useState(false);
  const lastFirstUrlRef = useRef<string | null>(null);
  const fadeTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const resumeTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Breaking news is prepended to the front of `articles` by the caller;
  // when that front item changes, jump the rotation to it immediately
  // instead of waiting for the timer to cycle back around to index 0.
  useEffect(() => {
    const firstUrl = articles[0]?.url ?? null;
    if (firstUrl !== lastFirstUrlRef.current) {
      lastFirstUrlRef.current = firstUrl;
      setIndex(0);
    }
  }, [articles]);

  useEffect(() => {
    return () => {
      clearTimeout(fadeTimeoutRef.current);
      clearTimeout(resumeTimeoutRef.current);
    };
  }, []);

  function transitionTo(computeNextIndex: (current: number) => number) {
    setFading(true);
    clearTimeout(fadeTimeoutRef.current);
    fadeTimeoutRef.current = setTimeout(() => {
      setIndex(computeNextIndex);
      setFading(false);
    }, FADE_DURATION_MS);
  }

  useEffect(() => {
    if (paused || hovering || articles.length <= 1) return;

    const intervalId = setInterval(() => {
      transitionTo((i) => (i + 1) % articles.length);
    }, ROTATE_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [articles.length, paused, hovering]);

  function handleManualNav(nextIndex: number) {
    transitionTo(() => ((nextIndex % articles.length) + articles.length) % articles.length);

    setPaused(true);
    clearTimeout(resumeTimeoutRef.current);
    resumeTimeoutRef.current = setTimeout(() => setPaused(false), RESUME_AFTER_MS);
  }

  if (articles.length === 0) return null;

  const safeIndex = index % articles.length;
  const current = articles[safeIndex];

  return (
    <div
      className="w-full max-w-5xl rounded-md border border-black/10 bg-foreground/5 p-4 dark:border-white/15"
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      <div className="flex items-center gap-2">
        <span className="flex shrink-0 items-center gap-1 rounded bg-red-500 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-white">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
          Live
        </span>

        {articles.length > 1 && (
          <button
            type="button"
            onClick={() => handleManualNav(safeIndex - 1)}
            aria-label="Previous headline"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-foreground/60 hover:bg-foreground/10 hover:text-foreground"
          >
            <ChevronLeft size={16} />
          </button>
        )}

        <a
          href={current.url}
          target="_blank"
          rel="noopener noreferrer"
          className={`min-w-0 flex-1 truncate transition-opacity duration-300 ${
            fading ? "opacity-0" : "opacity-100"
          }`}
        >
          <span className="mr-2 text-xs font-medium text-foreground/60">
            {current.source}
          </span>
          <span className="font-semibold text-foreground hover:underline">
            {current.title}
          </span>
        </a>

        {articles.length > 1 && (
          <button
            type="button"
            onClick={() => handleManualNav(safeIndex + 1)}
            aria-label="Next headline"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-foreground/60 hover:bg-foreground/10 hover:text-foreground"
          >
            <ChevronRight size={16} />
          </button>
        )}
      </div>

      {articles.length > 1 && (
        <div className="mt-3 flex justify-center gap-1.5">
          {articles.map((article, i) => (
            <button
              key={article.url}
              type="button"
              onClick={() => handleManualNav(i)}
              aria-label={`Show headline ${i + 1} of ${articles.length}`}
              className={`h-1.5 rounded-full transition-all ${
                i === safeIndex ? "w-6 bg-foreground" : "w-1.5 bg-foreground/20"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
