"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";
import type { QuizContent } from "@/lib/learning/types";

interface QuizScore {
  correct: number;
  total: number;
}

interface QuizSlideProps {
  quiz: QuizContent;
  alreadyCompleted: boolean;
  // justCompleted is true only when the user has just reached the summary
  // screen this session (first attempt or a retake) — used by the parent
  // to decide whether to bump the persisted quizzesCompleted count. `score`
  // is only present alongside `justCompleted: true`, for persisting the
  // certification-eligible score ledger.
  onFinish: (justCompleted: boolean, score?: QuizScore) => void;
}

export default function QuizSlide({ quiz, alreadyCompleted, onFinish }: QuizSlideProps) {
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [showSummary, setShowSummary] = useState(false);
  // Lets a user who already passed this checkpoint once retake it — e.g.
  // to raise a below-threshold score toward certification eligibility —
  // without that being a dead end (the earlier version only offered
  // "Continue" here).
  const [retaking, setRetaking] = useState(false);

  if (alreadyCompleted && !retaking) {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10 text-green-500">
          <Check size={24} />
        </span>
        <h2 className="text-xl font-bold text-foreground">Quiz already completed</h2>
        <p className="text-sm text-foreground/60">You&apos;ve already finished this quiz check — nice work.</p>
        <div className="mt-1 flex items-center gap-2">
          <button
            type="button"
            onClick={() => onFinish(false)}
            className="rounded-md bg-foreground px-5 py-2 text-sm font-semibold text-background transition-opacity hover:opacity-90"
          >
            Continue
          </button>
          <button
            type="button"
            onClick={() => {
              setRetaking(true);
              setQuestionIndex(0);
              setSelected(null);
              setCorrectCount(0);
              setShowSummary(false);
            }}
            className="rounded-md border border-black/10 px-5 py-2 text-sm font-medium text-foreground/70 transition-colors hover:text-foreground dark:border-white/15"
          >
            Retake this quiz
          </button>
        </div>
      </div>
    );
  }

  if (showSummary) {
    const total = quiz.questions.length;
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <h2 className="text-xl font-bold text-foreground">
          {correctCount}/{total} correct!
        </h2>
        <p className="text-sm text-foreground/60">
          {correctCount === total
            ? "Perfect score — you've got this concept down."
            : "Nice effort — keep going to reinforce what you've learned."}
        </p>
        <button
          type="button"
          onClick={() => onFinish(true, { correct: correctCount, total })}
          className="mt-3 rounded-md bg-foreground px-5 py-2 text-sm font-semibold text-background transition-opacity hover:opacity-90"
        >
          Continue
        </button>
      </div>
    );
  }

  const question = quiz.questions[questionIndex];
  const isLastQuestion = questionIndex === quiz.questions.length - 1;
  const revealed = selected !== null;

  function handleSelect(index: number) {
    if (selected !== null) return;
    setSelected(index);
    if (index === question.correctIndex) setCorrectCount((count) => count + 1);
  }

  function handleContinue() {
    if (isLastQuestion) {
      setShowSummary(true);
      return;
    }
    setQuestionIndex((index) => index + 1);
    setSelected(null);
  }

  return (
    <div className="flex flex-col gap-5">
      <span className="text-xs font-medium uppercase tracking-wide text-foreground/40">
        Quiz check — question {questionIndex + 1} of {quiz.questions.length}
      </span>
      <h2 className="text-xl font-semibold text-foreground sm:text-2xl">{question.question}</h2>

      <div className="flex flex-col gap-2">
        {question.options.map((option, index) => {
          const isSelected = selected === index;
          const isCorrectOption = index === question.correctIndex;

          let stateClasses =
            "border-black/10 hover:border-black/30 dark:border-white/15 dark:hover:border-white/30";
          if (revealed && isCorrectOption) {
            stateClasses = "border-green-500 bg-green-500/10";
          } else if (revealed && isSelected && !isCorrectOption) {
            stateClasses = "border-red-500 bg-red-500/10";
          }

          return (
            <button
              key={index}
              type="button"
              onClick={() => handleSelect(index)}
              disabled={revealed}
              className={`flex items-center justify-between gap-2 rounded-md border px-4 py-3 text-left text-sm transition-colors duration-150 disabled:cursor-default ${stateClasses}`}
            >
              <span className="text-foreground">{option}</span>
              {revealed && isCorrectOption && <Check size={16} className="shrink-0 text-green-500" />}
              {revealed && isSelected && !isCorrectOption && <X size={16} className="shrink-0 text-red-500" />}
            </button>
          );
        })}
      </div>

      {revealed && (
        <div
          className={`rounded-md border p-3 text-sm ${
            selected === question.correctIndex
              ? "border-green-500/30 bg-green-500/5"
              : "border-red-500/30 bg-red-500/5"
          }`}
        >
          {selected === question.correctIndex ? (
            <p className="text-foreground/80">
              <span className="font-semibold text-green-500">Correct!</span>{" "}
              {question.explanation ?? "Nice work."}
            </p>
          ) : (
            <p className="text-foreground/80">
              <span className="font-semibold text-red-500">Not quite.</span> The correct answer is{" "}
              <span className="font-semibold text-foreground">
                &quot;{question.options[question.correctIndex]}&quot;
              </span>
              {question.explanation ? ` — ${question.explanation}` : "."}
            </p>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={handleContinue}
        disabled={!revealed}
        className="self-start rounded-md bg-foreground px-5 py-2 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Continue
      </button>
    </div>
  );
}
