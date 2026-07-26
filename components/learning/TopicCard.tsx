"use client";

import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import ProgressRing, { type TopicStatus } from "./ProgressRing";
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

export default function TopicCard({ topicId, title, descriptor, percent, status, scorePercent }: TopicCardProps) {
  const visual = CONCEPT_VISUALS[topicId as ConceptSlug];
  const Icon = visual?.icon;
  const classes = CONCEPT_COLOR_CLASSES[visual?.color ?? "blue"];
  const hasScore = status === "completed" && typeof scorePercent === "number";
  const passing = hasScore && scorePercent! >= CERTIFICATION_PASS_THRESHOLD_PERCENT;

  return (
    <Link
      href={`/learning/${topicId}`}
      className={`group relative flex flex-col items-center gap-3 rounded-lg border bg-transparent p-6 text-center shadow-transparent transition-all duration-200 ease-out hover:-translate-y-1 hover:shadow-lg ${classes.border} ${classes.hoverBorder} ${classes.hoverShadow}`}
    >
      {status === "completed" && (
        <span
          className={`absolute right-3 top-3 flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold text-white ${
            hasScore ? (passing ? "bg-green-500" : "bg-amber-500") : "bg-green-500"
          }`}
          title={hasScore ? `${scorePercent}% average across this course's quiz checkpoints` : undefined}
        >
          {hasScore ? `${scorePercent}%` : <CheckCircle2 size={14} />}
        </span>
      )}

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
    </Link>
  );
}
