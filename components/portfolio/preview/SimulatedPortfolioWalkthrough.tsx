"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Pause, Play, ChevronLeft, ChevronRight } from "lucide-react";
import PickTierScene from "@/components/portfolio/preview/scenes/PickTierScene";
import PerformanceScene from "@/components/portfolio/preview/scenes/PerformanceScene";
import TradeScene from "@/components/portfolio/preview/scenes/TradeScene";
import HoldingsActivityScene from "@/components/portfolio/preview/scenes/HoldingsActivityScene";

// Byte-for-byte the same shell as ComplianceWalkthrough.tsx /
// ReportingWalkthrough.tsx / ModelPortfoliosWalkthrough.tsx /
// BenchmarkingWalkthrough.tsx (scene-in animation, caption, pause/play/
// manual nav, dot indicators, CTA) — same "Demo — sample data" badge, same
// signed-out-only placement (see app/portfolio/page.tsx), same
// public-preview behavior. Deliberately no firm/organization name anywhere
// in this walkthrough's sample data — Simulated Portfolio has no
// organizational concept at all (SimulatedPortfolio belongs only to a
// userId in the schema) and the real feature never shows firm branding.
const SCENE_DURATION_MS = 6500;

interface SceneDef {
  key: string;
  label: string;
  caption: string;
  Component: () => React.JSX.Element;
  durationMs?: number;
}

const SCENES: SceneDef[] = [
  {
    key: "pick-tier",
    label: "Pick a tier",
    caption:
      "Paper-trade any strategy risk-free before committing real capital — a client-facing way to explore ideas together, from a $1,000 starter balance up to $1M.",
    Component: PickTierScene,
  },
  {
    key: "performance",
    label: "Track performance",
    caption:
      "Real-time performance tracking against the market sits right alongside the portfolio itself — no manual net-worth spreadsheet to maintain.",
    Component: PerformanceScene,
    // A stat grid plus a live chart takes longer to read than this
    // walkthrough's simpler static scenes.
    durationMs: 8000,
  },
  {
    key: "trade",
    label: "Trade",
    caption:
      "Stocks, commodities, and crypto — all in one paper-trading portfolio, with no separate app or spreadsheet needed to track a multi-asset strategy.",
    Component: TradeScene,
  },
  {
    key: "holdings-activity",
    label: "Holdings & activity",
    caption:
      "A complete, always-current record of every paper trade — nothing to manually reconcile after the fact.",
    Component: HoldingsActivityScene,
  },
];

export default function SimulatedPortfolioWalkthrough() {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);

  const advance = useCallback((direction: 1 | -1) => {
    setIndex((i) => (i + direction + SCENES.length) % SCENES.length);
  }, []);

  useEffect(() => {
    if (!playing) return;
    const timer = setTimeout(() => advance(1), SCENES[index].durationMs ?? SCENE_DURATION_MS);
    return () => clearTimeout(timer);
  }, [index, playing, advance]);

  const { Component, caption } = SCENES[index];

  return (
    <div className="flex w-full max-w-4xl flex-col gap-4">
      <div className="relative">
        <span className="absolute -top-3 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full border border-black/10 bg-background px-3 py-1 text-xs font-medium text-foreground/50 shadow-sm dark:border-white/15">
          Demo — sample data
        </span>
        <div className="min-h-[22rem] overflow-hidden rounded-lg border border-black/10 bg-foreground/[0.02] p-6 pt-8 dark:border-white/15">
          <div key={index} className="animate-scene-in motion-reduce:animate-none">
            <Component />
          </div>
        </div>
      </div>

      <p key={`caption-${index}`} className="animate-scene-in motion-reduce:animate-none min-h-14 text-center text-sm leading-relaxed text-foreground/60 sm:min-h-10">
        {caption}
      </p>

      <div className="flex items-center justify-center gap-4">
        <button
          type="button"
          onClick={() => advance(-1)}
          aria-label="Previous step"
          className="rounded-full border border-black/10 p-2 text-foreground/60 transition-all duration-200 ease-out hover:border-black/25 hover:bg-foreground/5 hover:text-foreground active:scale-90 dark:border-white/15 dark:hover:border-white/30"
        >
          <ChevronLeft size={18} />
        </button>
        <button
          type="button"
          onClick={() => setPlaying((p) => !p)}
          aria-label={playing ? "Pause walkthrough" : "Play walkthrough"}
          className="rounded-full border border-indigo-400/30 bg-indigo-400/10 p-2.5 text-indigo-400 transition-all duration-200 ease-out hover:border-indigo-400/50 hover:bg-indigo-400/15 active:scale-90"
        >
          {playing ? <Pause size={18} /> : <Play size={18} />}
        </button>
        <button
          type="button"
          onClick={() => advance(1)}
          aria-label="Next step"
          className="rounded-full border border-black/10 p-2 text-foreground/60 transition-all duration-200 ease-out hover:border-black/25 hover:bg-foreground/5 hover:text-foreground active:scale-90 dark:border-white/15 dark:hover:border-white/30"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="flex justify-center gap-1.5">
        {SCENES.map((s, i) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setIndex(i)}
            aria-label={`Go to "${s.label}" step`}
            aria-current={i === index}
            className={`h-1.5 rounded-full transition-[width,background-color] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
              i === index ? "w-6 bg-indigo-400" : "w-1.5 bg-foreground/20 hover:bg-foreground/30"
            }`}
          />
        ))}
      </div>

      <Link
        href="/signup"
        className="self-center rounded-md bg-foreground px-6 py-3 text-sm font-medium text-background transition-opacity hover:opacity-90"
      >
        Create your account
      </Link>
    </div>
  );
}
