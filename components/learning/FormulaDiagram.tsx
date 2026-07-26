import { CONCEPT_COLOR_CLASSES } from "@/lib/conceptVisuals";
import type { FormulaSpec, FormulaTerm } from "@/lib/learning/types";

function TermBox({ term, emphasize = false }: { term: FormulaTerm; emphasize?: boolean }) {
  const classes = CONCEPT_COLOR_CLASSES[term.color];
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={`flex min-w-[5.5rem] items-center justify-center rounded-md border px-3 py-2 text-center font-semibold ${classes.border} ${
          emphasize ? classes.iconBg : "bg-foreground/[0.02]"
        } ${classes.icon}`}
      >
        {term.symbol}
      </div>
      <span className="max-w-[7rem] text-center text-[11px] leading-tight text-foreground/50">{term.meaning}</span>
    </div>
  );
}

// Formula-based concepts (P/E, PEG, EPS, EV/EBITDA, DCF) show their
// formula as labeled, color-coded boxes rather than plain text — each
// term's color comes from lib/conceptVisuals.ts so a term referencing
// another topic (e.g. "EPS" shown inside the P/E formula) is recognizably
// that topic's own color, not an arbitrary one.
export default function FormulaDiagram({ formula }: { formula: FormulaSpec }) {
  return (
    <div className="flex flex-wrap items-start justify-center gap-2 rounded-md border border-black/10 bg-foreground/[0.015] p-4 dark:border-white/10">
      {formula.terms.map((term, index) => (
        <div key={index} className="flex items-start gap-2">
          <TermBox term={term} />
          {index < formula.operators.length && (
            <span className="pt-2 text-lg font-semibold text-foreground/40">{formula.operators[index]}</span>
          )}
        </div>
      ))}
      <span className="pt-2 text-lg font-semibold text-foreground/40">=</span>
      <TermBox term={formula.result} emphasize />
    </div>
  );
}
