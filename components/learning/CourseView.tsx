"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { ArrowLeft, ArrowRight, ChevronLeft, Award, X } from "lucide-react";
import type { Course } from "@/lib/learning/types";
import ContentSlide from "./ContentSlide";
import QuizSlide from "./QuizSlide";

interface ProgressRow {
  topicId: string;
  highestSlideIndex: number;
  quizzesCompleted: number;
}

interface AwardedCertificate {
  trackId: string;
  trackTitle: string;
}

// Small centered overlay celebrating a just-earned certificate — mirrors
// the existing "expanded card" overlay pattern in app/stocks/page.tsx
// (fixed inset-0 + bg-black/70 backdrop, click-outside-to-close via a
// stopPropagation'd inner panel) rather than introducing a new modal
// component for this one occurrence.
function CertificateAwardedModal({ cert, onClose }: { cert: AwardedCertificate; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="relative flex w-full max-w-sm flex-col items-center gap-3 rounded-lg border border-amber-400/30 bg-background p-8 text-center shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-1 top-1 flex h-10 w-10 items-center justify-center text-foreground/40 hover:text-foreground"
        >
          <X size={16} />
        </button>
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-400/10 text-amber-500">
          <Award size={28} />
        </span>
        <h2 className="text-xl font-bold text-foreground">Certificate earned!</h2>
        <p className="text-sm text-foreground/70">
          You&apos;ve completed every course in <span className="font-semibold text-foreground">{cert.trackTitle}</span>{" "}
          with a passing score — nice work.
        </p>
        <Link
          href="/learning/certifications"
          className="mt-2 rounded-md bg-foreground px-5 py-2 text-sm font-semibold text-background transition-opacity hover:opacity-90"
        >
          View my certificate
        </Link>
      </div>
    </div>
  );
}

// One-shot fade + slide-in whenever `slideKey` changes, matching the
// setTimeout-based (not requestAnimationFrame-based) reveal technique
// already established by components/RevealOnScroll.tsx — rAF was tried
// there first and found unreliable right after navigation.
// Remounted via a `key={slideIndex}` from the caller on every slide
// change, so `visible` naturally starts `false` again each time — no
// synchronous reset needed in the effect body itself.
function SlideTransition({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timeoutId = setTimeout(() => setVisible(true), 0);
    return () => clearTimeout(timeoutId);
  }, []);

  return (
    <div
      className={`transition-all duration-300 ease-out ${
        visible ? "translate-x-0 opacity-100" : "translate-x-3 opacity-0"
      }`}
    >
      {children}
    </div>
  );
}

function quizNumberForIndex(course: Course, index: number): number {
  let count = 0;
  for (let i = 0; i <= index; i++) {
    if (course.slides[i]?.type === "quiz") count++;
  }
  return count;
}

export default function CourseView({ course }: { course: Course }) {
  const { status } = useSession();
  const totalSlides = course.slides.length;
  const lastIndex = totalSlides - 1;

  const [slideIndex, setSlideIndex] = useState(0);
  const [quizzesCompleted, setQuizzesCompleted] = useState(0);
  const [awardedCertificate, setAwardedCertificate] = useState<AwardedCertificate | null>(null);
  const hasLoadedProgressRef = useRef(false);

  // Resumes where the user left off once their persisted progress loads —
  // anonymous visitors just start fresh at slide 0 with local-only state.
  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (status !== "authenticated") return;

      const response = await fetch("/api/learning/progress").catch(() => null);
      const body = response?.ok ? await response.json().catch(() => null) : null;
      if (cancelled || !body) return;

      const rows: ProgressRow[] = Array.isArray(body.progress) ? body.progress : [];
      const row = rows.find((r) => r.topicId === course.topicId);
      if (row && !hasLoadedProgressRef.current) {
        hasLoadedProgressRef.current = true;
        setSlideIndex(Math.min(row.highestSlideIndex, lastIndex));
        setQuizzesCompleted(row.quizzesCompleted);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [status, course.topicId, lastIndex]);

  async function persist(
    nextSlideIndex: number,
    nextQuizzesCompleted: number,
    quizResult?: { quizIndex: number; correct: number; total: number }
  ) {
    if (status !== "authenticated") return;
    try {
      const response = await fetch("/api/learning/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topicId: course.topicId,
          highestSlideIndex: Math.min(nextSlideIndex, lastIndex),
          quizzesCompleted: nextQuizzesCompleted,
          quizResult,
        }),
      });
      const body = response.ok ? await response.json().catch(() => null) : null;
      if (body?.certificateAwarded) {
        setAwardedCertificate(body.certificateAwarded);
      }
    } catch {
      // Transient failure — progress simply won't be saved for this step.
    }
  }

  function goTo(index: number) {
    const clamped = Math.max(0, Math.min(totalSlides, index));
    setSlideIndex(clamped);
    if (clamped > 0) persist(clamped, quizzesCompleted);
  }

  const isCompletionScreen = slideIndex >= totalSlides;
  const currentSlide = isCompletionScreen ? null : course.slides[slideIndex];
  const onIncompleteQuiz =
    currentSlide?.type === "quiz" && quizzesCompleted < quizNumberForIndex(course, slideIndex);

  function handleQuizFinish(justCompleted: boolean, score?: { correct: number; total: number }) {
    const nextQuizzesCompleted = justCompleted
      ? Math.max(quizzesCompleted, quizNumberForIndex(course, slideIndex))
      : quizzesCompleted;
    if (justCompleted) setQuizzesCompleted(nextQuizzesCompleted);
    const nextIndex = slideIndex + 1;
    setSlideIndex(nextIndex);
    const quizResult = score
      ? { quizIndex: quizNumberForIndex(course, slideIndex) - 1, correct: score.correct, total: score.total }
      : undefined;
    persist(nextIndex, nextQuizzesCompleted, quizResult);
  }

  const progressPercent = Math.round((Math.min(slideIndex, lastIndex) + 1) / totalSlides * 100);

  return (
    <div className="flex w-full flex-col items-center gap-6 px-4 py-10 sm:px-8">
      <div className="flex w-full max-w-2xl flex-col gap-3">
        <div className="flex items-center justify-between">
          <Link
            href="/learning"
            className="inline-flex items-center gap-1 text-sm text-foreground/60 transition-colors hover:text-foreground"
          >
            <ChevronLeft size={16} />
            Learning Hub
          </Link>
          <span className="text-xs text-foreground/50">
            {Math.min(slideIndex, lastIndex) + 1} / {totalSlides}
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/15">
          <div
            className="h-full rounded-full bg-foreground transition-all duration-300 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {status !== "authenticated" && status !== "loading" && (
        <div className="flex w-full max-w-2xl items-center justify-between gap-3 rounded-md border border-amber-400/30 bg-amber-400/5 px-4 py-2 text-sm">
          <span className="text-foreground/70">Sign in to save your progress across visits.</span>
          <Link href="/login" className="font-medium text-foreground hover:underline">
            Sign in →
          </Link>
        </div>
      )}

      <div className="min-h-[360px] w-full max-w-2xl rounded-lg border border-black/10 p-6 dark:border-white/15 sm:p-10">
        {isCompletionScreen ? (
          <SlideTransition key={slideIndex}>
            <div className="flex flex-col items-center gap-4 py-8 text-center">
              <h2 className="text-2xl font-bold text-foreground">Course complete! 🎉</h2>
              <p className="text-sm text-foreground/60">
                You&apos;ve finished every slide and quiz in {course.title}.
              </p>
              {course.toolHref && (
                <Link
                  href={course.toolHref}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-black/10 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:border-black/30 dark:border-white/15 dark:hover:border-white/30"
                >
                  Try the {course.toolLabel ?? "calculator"}
                  <ArrowRight size={14} />
                </Link>
              )}
              <Link
                href="/learning"
                className="mt-1 text-sm font-medium text-foreground/60 hover:text-foreground hover:underline"
              >
                Back to Learning Hub
              </Link>
            </div>
          </SlideTransition>
        ) : (
          <SlideTransition key={slideIndex}>
            {currentSlide?.type === "content" ? (
              <ContentSlide
                title={currentSlide.title}
                body={currentSlide.body}
                topicId={course.topicId}
                showNewsExample={currentSlide.showNewsExample}
                deepDive={currentSlide.deepDive}
                caseStudy={currentSlide.caseStudy}
                visual={currentSlide.visual}
                formula={currentSlide.formula}
              />
            ) : currentSlide?.type === "quiz" ? (
              <QuizSlide
                quiz={currentSlide.quiz}
                alreadyCompleted={quizzesCompleted >= quizNumberForIndex(course, slideIndex)}
                onFinish={handleQuizFinish}
              />
            ) : null}
          </SlideTransition>
        )}
      </div>

      {!isCompletionScreen && (
        <div className="flex w-full max-w-2xl items-center justify-between">
          <button
            type="button"
            onClick={() => goTo(slideIndex - 1)}
            disabled={slideIndex === 0}
            className="inline-flex items-center gap-1.5 rounded-md border border-black/10 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:border-black/30 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/15 dark:hover:border-white/30"
          >
            <ArrowLeft size={14} />
            Previous
          </button>

          {!onIncompleteQuiz && (
            <button
              type="button"
              onClick={() => goTo(slideIndex + 1)}
              className="inline-flex items-center gap-1.5 rounded-md bg-foreground px-4 py-2 text-sm font-semibold text-background transition-opacity hover:opacity-90"
            >
              Next
              <ArrowRight size={14} />
            </button>
          )}
        </div>
      )}

      {awardedCertificate && (
        <CertificateAwardedModal cert={awardedCertificate} onClose={() => setAwardedCertificate(null)} />
      )}
    </div>
  );
}
