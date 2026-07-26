import { Landmark } from "lucide-react";
import HighlightedText from "./HighlightedText";
import type { CaseStudy } from "@/lib/learning/types";

// A real historical example, always source-cited — visually distinct from
// the main lesson body (bordered callout, not just another paragraph) so
// it reads as "here's the concept in the real world," not filler text.
export default function CaseStudyCard({ caseStudy, topicId }: { caseStudy: CaseStudy; topicId: string }) {
  return (
    <div className="flex flex-col gap-2 rounded-md border border-amber-400/25 bg-amber-400/[0.04] p-4">
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-400/10 text-amber-500">
          <Landmark size={13} />
        </span>
        <span className="text-xs font-semibold uppercase tracking-wide text-amber-500">Case study</span>
      </div>
      <h3 className="font-semibold text-foreground">{caseStudy.title}</h3>
      <div className="flex flex-col gap-2 text-sm leading-relaxed text-foreground/80">
        {caseStudy.body.map((paragraph, index) => (
          <p key={index}>
            <HighlightedText text={paragraph} topicId={topicId} />
          </p>
        ))}
      </div>
      <p className="text-xs text-foreground/50">
        Source: {caseStudy.source}
        {caseStudy.sourceUrl && (
          <>
            {" — "}
            <a
              href={caseStudy.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-foreground"
            >
              view source
            </a>
          </>
        )}
      </p>
    </div>
  );
}
