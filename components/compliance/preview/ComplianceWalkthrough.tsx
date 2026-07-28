"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Pause, Play, ChevronLeft, ChevronRight } from "lucide-react";
import RestrictedListScene from "@/components/compliance/preview/scenes/RestrictedListScene";
import DisclosureScene from "@/components/compliance/preview/scenes/DisclosureScene";
import FlagScene from "@/components/compliance/preview/scenes/FlagScene";
import PreclearanceScene from "@/components/compliance/preview/scenes/PreclearanceScene";
import AuditLogScene from "@/components/compliance/preview/scenes/AuditLogScene";

// Bumped from the original 5500ms alongside the caption rewrite below —
// the new captions are real explanations (1-2 full sentences) rather than
// short action labels, and need a bit more time to read comfortably
// alongside the scene itself without pacing feeling rushed. Per-scene
// `durationMs` (see "preclearance" below) overrides this default for a
// scene with meaningfully more to show/read than the others.
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
    key: "restricted",
    label: "Restricted list",
    caption:
      "Compliance sets the restricted list once — every employee sees it in real time, so no one can claim they didn't know a ticker was off-limits.",
    Component: RestrictedListScene,
  },
  {
    key: "disclosure",
    label: "Trade disclosure",
    caption:
      "Trade disclosures take seconds, right where employees already work — removing the friction that causes trades to go unreported in the first place.",
    Component: DisclosureScene,
  },
  {
    key: "flag",
    label: "Automatic flag",
    caption:
      "Every disclosed trade is automatically checked against real insider-filing activity — risky trades surface the moment they're reported, not months later in an audit.",
    Component: FlagScene,
  },
  {
    key: "preclearance",
    label: "Pre-clearance",
    caption:
      "High-risk trades require sign-off before they're placed — now with an AI-drafted flag, rationale, and suggested note that saves officers real review time, without ever deciding for them. Try clicking Approve or Deny yourself.",
    Component: PreclearanceScene,
    // This scene now also plays out the AI-Assisted Review step (collapsed
    // -> expanded -> analyzing -> result -> note applied -> approved) on
    // top of its original approve/deny beat — meaningfully more to read
    // than every other scene, hence the longer-than-default runtime.
    durationMs: 9500,
  },
  {
    key: "audit",
    label: "Audit log",
    caption:
      "Every approval, flag, and list change lands in one immutable record — ready to hand a regulator without weeks of reconstruction.",
    Component: AuditLogScene,
  },
];

export default function ComplianceWalkthrough() {
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
