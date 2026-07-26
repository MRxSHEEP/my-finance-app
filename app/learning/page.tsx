"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Award } from "lucide-react";
import RevealOnScroll from "@/components/RevealOnScroll";
import FadeInOnMount from "@/components/FadeInOnMount";
import TopicCard from "@/components/learning/TopicCard";
import type { TopicStatus } from "@/components/learning/ProgressRing";
import { COURSES } from "@/lib/learning/courses";
import { CERTIFICATION_TRACKS, computeCourseScorePercent } from "@/lib/learning/certificationTracks";

interface ProgressRow {
  topicId: string;
  highestSlideIndex: number;
  quizzesCompleted: number;
  completedAt: string | null;
  quizScores: unknown;
}

const TOTAL_SLIDES_PER_COURSE = 9;

export default function LearningPage() {
  const { status } = useSession();
  const [progress, setProgress] = useState<ProgressRow[] | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (status !== "authenticated") {
        if (!cancelled) setProgress([]);
        return;
      }

      const response = await fetch("/api/learning/progress").catch(() => null);
      const body = response?.ok ? await response.json().catch(() => null) : null;
      if (cancelled) return;

      setProgress(Array.isArray(body?.progress) ? body.progress : []);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [status]);

  return (
    <main className="flex flex-1 flex-col items-center gap-8 p-8 pt-16 pb-20">
      <RevealOnScroll className="flex w-full max-w-2xl flex-col items-center gap-3 text-center">
        <h1 className="text-3xl font-bold text-foreground">Learning</h1>
        <p className="max-w-lg text-sm text-foreground/60">
          Bite-sized courses on the concepts used throughout Noble — work through the slides,
          check your understanding with a few quick questions, and pick up right where you left
          off next time.
        </p>
        <Link
          href="/learning/certifications"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-amber-500 hover:underline"
        >
          <Award size={14} /> My Certifications
        </Link>
      </RevealOnScroll>

      <div className="flex w-full max-w-5xl flex-col gap-10">
        {CERTIFICATION_TRACKS.map((track, trackIndex) => {
          const trackCourses = track.topicIds
            .map((topicId) => COURSES.find((c) => c.topicId === topicId))
            .filter((c): c is (typeof COURSES)[number] => !!c);

          const completedCount = track.topicIds.filter(
            (topicId) => progress?.find((r) => r.topicId === topicId)?.completedAt
          ).length;

          return (
            <RevealOnScroll key={track.id} className="flex w-full flex-col gap-5" delayMs={trackIndex * 60}>
              <div className="flex flex-col gap-1 border-b border-black/10 pb-3 dark:border-white/15">
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                  <h2 className="text-xl font-bold text-foreground">{track.title}</h2>
                  <span className="text-xs font-medium text-foreground/50">
                    {completedCount}/{track.topicIds.length} complete
                  </span>
                </div>
                <p className="text-sm text-foreground/60">{track.description}</p>
              </div>

              <div className="grid w-full grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {trackCourses.map((course, index) => {
                  const row = progress?.find((r) => r.topicId === course.topicId);
                  const highestSlideIndex = row?.highestSlideIndex ?? 0;
                  const quizzesCompleted = row?.quizzesCompleted ?? 0;
                  const percent = row
                    ? Math.round(
                        ((Math.min(highestSlideIndex, TOTAL_SLIDES_PER_COURSE - 1) + 1) / TOTAL_SLIDES_PER_COURSE) *
                          100
                      )
                    : 0;
                  const cardStatus: TopicStatus = row?.completedAt
                    ? "completed"
                    : highestSlideIndex > 0 || quizzesCompleted > 0
                      ? "in-progress"
                      : "not-started";
                  const scorePercent = row ? computeCourseScorePercent(row.quizScores) : null;

                  return (
                    <FadeInOnMount key={course.topicId} delayMs={index * 40}>
                      <TopicCard
                        topicId={course.topicId}
                        title={course.title}
                        descriptor={course.descriptor}
                        percent={row?.completedAt ? 100 : percent}
                        status={cardStatus}
                        scorePercent={scorePercent}
                      />
                    </FadeInOnMount>
                  );
                })}
              </div>
            </RevealOnScroll>
          );
        })}
      </div>
    </main>
  );
}
