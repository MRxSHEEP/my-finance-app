"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Pause, Play, ChevronLeft, ChevronRight } from "lucide-react";
import ConfigurePeerSetScene from "@/components/benchmarking/preview/scenes/ConfigurePeerSetScene";
import CurrentComparisonScene from "@/components/benchmarking/preview/scenes/CurrentComparisonScene";
import TrendScene from "@/components/benchmarking/preview/scenes/TrendScene";

// Byte-for-byte the same shell as ComplianceWalkthrough.tsx /
// ReportingWalkthrough.tsx / ModelPortfoliosWalkthrough.tsx (scene-in
// animation, caption, pause/play/manual nav, dot indicators, CTA) — same
// "Demo — sample data" badge, same signed-out-only placement (see
// app/benchmarking/page.tsx), same public-preview behavior. Only the
// SCENES list and per-scene sample data differ. Three scenes, not four —
// the real Peer Benchmarking flow is genuinely three beats (configure,
// compare, trend), not padded to match the other walkthroughs' scene count.
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
    key: "configure",
    label: "Configure peer set",
    caption:
      "Validated real tickers, not free text that can silently fail — a peer set built in minutes, with numbers on the other side that are always real.",
    Component: ConfigurePeerSetScene,
  },
  {
    key: "comparison",
    label: "Current comparison",
    caption:
      "See exactly how a core holding stacks up against its closest peers, metric by metric — the best value in each row highlighted automatically, no manual spreadsheet comparison required.",
    Component: CurrentComparisonScene,
    // A firm-branded header plus a full 6-metric table takes longer to
    // read than this walkthrough's simpler static scene.
    durationMs: 8000,
  },
  {
    key: "trend",
    label: "Trend chart",
    caption:
      "Trends build automatically over time, so a firm can show not just where a holding stands today, but where it's headed — no separate tracking sheet to maintain.",
    Component: TrendScene,
  },
];

export default function BenchmarkingWalkthrough() {
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
        Create your organization
      </Link>
    </div>
  );
}
