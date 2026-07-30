"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import ProgressRing, { type TopicStatus } from "./ProgressRing";
import HighlightedText from "./HighlightedText";
import { CONCEPT_VISUALS, CONCEPT_COLOR_CLASSES, type ConceptSlug } from "@/lib/conceptVisuals";
import { CERTIFICATION_PASS_THRESHOLD_PERCENT } from "@/lib/learning/certificationTracks";

interface TopicCardProps {
  topicId: string;
  title: string;
  descriptor: string;
  percent: number;
  status: TopicStatus;
  // Pooled correct/total across this course's own quiz checkpoints — null
  // until at least one checkpoint has been answered. Same computation
  // (computeCourseScorePercent) that feeds the course's contribution to
  // its certification track's average, so this badge and that average
  // never tell two different stories about the same course.
  scorePercent?: number | null;
  // Opening paragraphs of the course's first slide (lib/learning/courses.ts),
  // reused verbatim as the hover/focus "back" layer — never new copy.
  introBody: string[];
}

// Crossfade only where hovering is a real pointer gesture, not a tap —
// (pointer: fine) additionally excludes stylus/hybrid devices that report
// hover:hover but would otherwise get a flash-then-navigate on tap. Written
// as complete literal class strings (not built from a shared constant) —
// Tailwind's static scanner only recognizes whole class names it can find
// verbatim in source, not ones assembled at runtime via interpolation.
//
// [grid-area:1/1] on both layers (rather than absolute+inset-0) stacks them
// in the same grid cell without removing either from flow, so the parent
// grid track sizes itself to the taller of the two automatically — no
// fixed height to compute/maintain, no clipping at larger zoom/font sizes.
const FRONT_LAYER_CLASSES =
  "[grid-area:1/1] flex flex-col items-center justify-center gap-3 p-6 opacity-100 transition-opacity duration-300 ease-out motion-reduce:duration-0 [@media(hover:hover)_and_(pointer:fine)]:group-hover:opacity-0 [@media(hover:hover)_and_(pointer:fine)]:group-focus-visible:opacity-0 [@media(hover:hover)_and_(pointer:fine)]:group-focus-within:opacity-0";
const BACK_LAYER_CLASSES =
  "[grid-area:1/1] flex flex-col items-center justify-center gap-3 p-6 opacity-0 transition-opacity duration-300 ease-out motion-reduce:duration-0 [@media(hover:hover)_and_(pointer:fine)]:group-hover:opacity-100 [@media(hover:hover)_and_(pointer:fine)]:group-focus-visible:opacity-100 [@media(hover:hover)_and_(pointer:fine)]:group-focus-within:opacity-100";

// Mirrors the CSS gate in JS so the aria-hidden swap below can never fire
// on a device where the visual crossfade doesn't (a tap triggering a
// synthetic focus/mouseenter, say) — otherwise a screen reader would
// announce the back face while the screen still shows the front one.
function isFinePointerHoverCapable() {
  return typeof window !== "undefined" && window.matchMedia("(hover: hover) and (pointer: fine)").matches;
}

// Distinct from the initial "Start course" label so a returning user can
// tell at a glance whether clicking through means starting fresh,
// resuming, or specifically retaking a quiz to improve a score — rather
// than every card reading the same regardless of progress.
const ACTION_LABEL: Record<TopicStatus, string> = {
  "not-started": "Start course",
  "in-progress": "Continue",
  completed: "Retake quiz",
};

export default function TopicCard({
  topicId,
  title,
  descriptor,
  percent,
  status,
  scorePercent,
  introBody,
}: TopicCardProps) {
  const visual = CONCEPT_VISUALS[topicId as ConceptSlug];
  const Icon = visual?.icon;
  const classes = CONCEPT_COLOR_CLASSES[visual?.color ?? "blue"];
  const hasScore = status === "completed" && typeof scorePercent === "number";
  const passing = hasScore && scorePercent! >= CERTIFICATION_PASS_THRESHOLD_PERCENT;
  // Drives aria-hidden on the inactive layer only — the visual crossfade
  // itself stays pure CSS (group-hover/group-focus-*). Gated to the same
  // (hover: hover) and (pointer: fine) condition as the CSS (see
  // isFinePointerHoverCapable above) so aria-hidden and what's actually on
  // screen never disagree.
  const [revealed, setRevealed] = useState(false);

  return (
    <Link
      href={`/learning/${topicId}`}
      aria-label={title}
      onMouseEnter={() => isFinePointerHoverCapable() && setRevealed(true)}
      onMouseLeave={() => setRevealed(false)}
      onFocus={() => isFinePointerHoverCapable() && setRevealed(true)}
      onBlur={() => setRevealed(false)}
      className={`group relative flex h-full flex-col items-center rounded-lg border bg-transparent text-center shadow-transparent transition-all duration-200 ease-out hover:-translate-y-1 hover:shadow-lg ${classes.border} ${classes.hoverBorder} ${classes.hoverShadow}`}
    >
      {status === "completed" && (
        <span
          className={`absolute right-3 top-3 z-10 flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold text-white ${
            hasScore ? (passing ? "bg-green-500" : "bg-amber-500") : "bg-green-500"
          }`}
          title={hasScore ? `${scorePercent}% average across this course's quiz checkpoints` : undefined}
        >
          {hasScore ? `${scorePercent}%` : <CheckCircle2 size={14} />}
        </span>
      )}

      {/* Both faces below share this single grid cell ([grid-area:1/1] on
          each) instead of being absolutely positioned, so the row sizes
          itself to whichever face is taller per-card — no fixed height to
          compute, no whitespace on short cards, no clipping risk at
          larger zoom/font sizes. */}
      <div className="grid w-full">
        <div aria-hidden={revealed} className={FRONT_LAYER_CLASSES}>
          {/* Ring stays a muted track until there's real progress to show —
              nothing to fill in yet on a not-started card. */}
          <ProgressRing percent={percent} strokeClassName={percent > 0 ? classes.stroke : "stroke-foreground/15"}>
            <div className={`flex h-11 w-11 items-center justify-center rounded-full ring-1 ${classes.iconBg} ${classes.iconRing}`}>
              {Icon && <Icon size={20} className={classes.icon} />}
            </div>
          </ProgressRing>

          <div>
            <h3 className="font-semibold text-foreground">{title}</h3>
            <p className="text-xs text-foreground/50">{descriptor}</p>
          </div>

          <span className={`text-xs font-medium ${classes.icon}`}>{ACTION_LABEL[status]} →</span>
        </div>

        <div aria-hidden={!revealed} className={BACK_LAYER_CLASSES}>
          <p className="text-xs leading-relaxed text-foreground/70">
            {introBody.map((paragraph, i) => (
              <span key={i}>
                <HighlightedText text={paragraph} topicId={topicId} />{" "}
              </span>
            ))}
          </p>
          <span className={`text-xs font-medium ${classes.icon}`}>{ACTION_LABEL[status]} →</span>
        </div>
      </div>
    </Link>
  );
}
