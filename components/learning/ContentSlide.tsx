import { BookOpen } from "lucide-react";
import InTheNewsCard from "./InTheNewsCard";
import HighlightedText from "./HighlightedText";
import CaseStudyCard from "./CaseStudyCard";
import FormulaDiagram from "./FormulaDiagram";
import ComparisonBarChart from "./ComparisonBarChart";
import HowItWorksAccordion from "@/components/tools/HowItWorksAccordion";
import CashFlowBarChart from "@/components/tools/CashFlowBarChart";
import { CONCEPT_VISUALS, CONCEPT_COLOR_CLASSES, type ConceptSlug } from "@/lib/conceptVisuals";
import type { CaseStudy, DeepDive, FormulaSpec, SlideVisual } from "@/lib/learning/types";

interface ContentSlideProps {
  title: string;
  body: string[];
  topicId: string;
  showNewsExample?: boolean;
  deepDive?: DeepDive;
  caseStudy?: CaseStudy;
  visual?: SlideVisual;
  formula?: FormulaSpec;
}

export default function ContentSlide({
  title,
  body,
  topicId,
  showNewsExample,
  deepDive,
  caseStudy,
  visual,
  formula,
}: ContentSlideProps) {
  const color = CONCEPT_VISUALS[topicId as ConceptSlug]?.color ?? "blue";
  const colorClasses = CONCEPT_COLOR_CLASSES[color];

  return (
    <div className="flex flex-col gap-5">
      <h2 className="text-2xl font-bold text-foreground sm:text-3xl">{title}</h2>
      <div className="flex flex-col gap-3 text-[15px] leading-relaxed text-foreground/80">
        {body.map((paragraph, index) => (
          <p key={index}>
            <HighlightedText text={paragraph} topicId={topicId} />
          </p>
        ))}
      </div>

      {formula && <FormulaDiagram formula={formula} />}

      {visual?.type === "comparison-bar" && <ComparisonBarChart spec={visual} color={color} />}

      {visual?.type === "cash-flow" && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium text-foreground/70">{visual.title}</p>
          <div className="h-56 w-full">
            <CashFlowBarChart data={visual.rows} />
          </div>
        </div>
      )}

      {caseStudy && <CaseStudyCard caseStudy={caseStudy} topicId={topicId} />}

      {showNewsExample && <InTheNewsCard topicId={topicId} />}

      {deepDive && (
        <HowItWorksAccordion label={deepDive.title} icon={BookOpen} iconColorClass={colorClasses.icon}>
          {deepDive.body.map((paragraph, index) => (
            <p key={index}>
              <HighlightedText text={paragraph} topicId={topicId} />
            </p>
          ))}
        </HowItWorksAccordion>
      )}
    </div>
  );
}
