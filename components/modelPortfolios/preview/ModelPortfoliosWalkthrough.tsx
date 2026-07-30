"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Pause, Play, ChevronLeft, ChevronRight } from "lucide-react";
import BuildAllocationScene from "@/components/modelPortfolios/preview/scenes/BuildAllocationScene";
import PerformanceScene from "@/components/modelPortfolios/preview/scenes/PerformanceScene";
import ShareLinkScene from "@/components/modelPortfolios/preview/scenes/ShareLinkScene";
import ClientViewScene from "@/components/modelPortfolios/preview/scenes/ClientViewScene";

// Byte-for-byte the same shell as ComplianceWalkthrough.tsx /
// ReportingWalkthrough.tsx (scene-in animation, caption, pause/play/manual
// nav, dot indicators, CTA), same signed-out-only placement (see
// app/portfolios/models/page.tsx), same public-preview behavior. The badge
// text is its own thing here, not shared — see the note next to it below
// (this scene's own sampleData.ts uses real, frozen quotes, unlike
// Compliance/Reporting's fictional data, so the badge says so explicitly
// rather than reusing "Demo — sample data" verbatim). Only the SCENES list
// and per-scene sample data differ.
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
    key: "build-allocation",
    label: "Build the allocation",
    caption:
      "Set a target allocation once, then apply it to every client who fits this model — instead of rebuilding the same spreadsheet for each of them.",
    Component: BuildAllocationScene,
  },
  {
    key: "performance",
    label: "Track performance",
    caption:
      "Ongoing performance tracking against a real benchmark lives right alongside the allocation — no separate spreadsheet to maintain outside the app.",
    Component: PerformanceScene,
    // A stat grid, a live chart, and a holdings table together take longer
    // to read than this walkthrough's simpler static scenes.
    durationMs: 8000,
  },
  {
    key: "share-link",
    label: "Share a read-only link",
    caption:
      "A secure, no-login link builds client trust and cuts down the \"can you send me an update\" emails — they can check in on this portfolio whenever they want, never your other portfolios.",
    Component: ShareLinkScene,
  },
  {
    key: "client-view",
    label: "The client's view",
    caption:
      "What the client actually opens — clean, firm-branded, and completely read-only. No login, no way to see anything else in your firm's account.",
    Component: ClientViewScene,
    durationMs: 8500,
  },
];

export default function ModelPortfoliosWalkthrough() {
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
        {/* Real, live quotes (see this scene's sampleData.ts — VOO/QQQ/VNQ
            "current" prices), frozen at a point in time rather than
            fictional — the badge says so explicitly instead of reusing
            "Demo — sample data" verbatim, since that phrasing would
            misrepresent this data as invented. */}
        <span className="absolute -top-3 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full border border-black/10 bg-background px-3 py-1 text-xs font-medium text-foreground/50 shadow-sm dark:border-white/15">
          Demo — real data, frozen Jul 28, 2026
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
