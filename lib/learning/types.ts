import type { ConceptColor } from "@/lib/conceptVisuals";

export interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  // Optional: shown after answering, alongside the correct option. When
  // omitted, the quiz UI falls back to just naming the correct answer.
  explanation?: string;
}

export interface QuizContent {
  questions: QuizQuestion[];
}

// A single term in a formula breakdown (see components/learning/FormulaDiagram.tsx).
export interface FormulaTerm {
  symbol: string; // short label shown inside the box, e.g. "Price"
  meaning: string; // fuller caption shown beneath it, e.g. "Current share price"
  color: ConceptColor;
}

// Formula-based concepts (P/E, PEG, EPS, EV/EBITDA, DCF) render their
// formula as labeled, color-coded boxes rather than plain text — terms
// combined left-to-right by `operators` (one fewer than `terms`), equaling
// `result`.
export interface FormulaSpec {
  terms: FormulaTerm[];
  operators: string[];
  result: FormulaTerm;
}

// A simple single-series bar comparison (e.g. P/E across a handful of
// companies) — deliberately one hue per the dataviz convention for a
// single magnitude series, not a categorical palette.
export interface ComparisonBarSpec {
  type: "comparison-bar";
  title: string;
  unit?: string; // e.g. "x" for a ratio, "$" for currency
  bars: { label: string; value: number; highlight?: boolean }[];
}

// Reuses components/tools/CashFlowBarChart.tsx's exact existing data shape
// (built for the DCF calculator) rather than a new chart component.
export interface CashFlowVisualSpec {
  type: "cash-flow";
  title: string;
  rows: { year: number; projectedFcf: number; presentValue: number }[];
}

export type SlideVisual = ComparisonBarSpec | CashFlowVisualSpec;

// Shown as a collapsed-by-default expansion (reuses
// components/tools/HowItWorksAccordion.tsx) for users who want more than
// the surface-level explanation.
export interface DeepDive {
  title: string;
  body: string[];
}

// A real historical example, always source-cited — never a fabricated or
// unsourced "example." `sourceUrl` is optional (some citations are to a
// named report/filing rather than a single URL) but `source` (the
// publication/author/filing) is always required.
export interface CaseStudy {
  title: string;
  body: string[];
  source: string;
  sourceUrl?: string;
}

export type CourseSlide =
  | {
      type: "content";
      title: string;
      // Paragraphs may contain inline glossary markup: `[[Display Text|slug]]`.
      // Parsed and rendered by components/learning/HighlightedText.tsx;
      // `slug` must exist in lib/learning/glossary.ts's GLOSSARY registry.
      body: string[];
      showNewsExample?: boolean;
      deepDive?: DeepDive;
      caseStudy?: CaseStudy;
      visual?: SlideVisual;
      formula?: FormulaSpec;
    }
  | { type: "quiz"; quiz: QuizContent };

export interface Course {
  topicId: string;
  title: string;
  descriptor: string;
  slides: CourseSlide[];
  toolHref?: string;
  toolLabel?: string;
}
