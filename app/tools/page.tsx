"use client";

import Link from "next/link";
import { Wrench } from "lucide-react";
import RevealOnScroll from "@/components/RevealOnScroll";
import DisclaimerCallout from "@/components/tools/DisclaimerCallout";
import { TOOL_CATEGORIES, TOOL_CATEGORY_COLORS, TOOLS, type ToolCategory, type ToolDef } from "@/lib/toolsMeta";
import { CONCEPT_VISUALS, CONCEPT_COLOR_CLASSES } from "@/lib/conceptVisuals";

const STAGGER_MS = 40;

function ToolCardTile({ tool, delayMs }: { tool: ToolDef; delayMs: number }) {
  // Card border/hover-glow stay category-colored (Valuation/Simulation/
  // Risk & Trading/Screening each get one accent family); the icon badge
  // and tag pill are colored per-concept instead, from the same registry
  // Learning's TopicCard uses — so a tool that's also a Learning course
  // (DCF, EBITDA, EV/EBITDA, PEG, DCA) shows the identical icon/color in
  // both sections.
  const categoryColors = TOOL_CATEGORY_COLORS[tool.category];
  const { icon: Icon, color } = CONCEPT_VISUALS[tool.concept];
  const conceptColors = CONCEPT_COLOR_CLASSES[color];

  return (
    <RevealOnScroll delayMs={delayMs}>
      <Link
        href={tool.href}
        className={`group flex h-full flex-col gap-3 rounded-lg border bg-foreground/[0.02] p-4 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-lg ${categoryColors.border} ${categoryColors.borderHover} ${categoryColors.glow}`}
      >
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${conceptColors.iconBg}`}>
          <Icon size={20} className={conceptColors.icon} />
        </div>
        <div className="flex flex-col gap-1">
          <h3 className="font-semibold text-foreground">{tool.title}</h3>
          <p className="text-sm text-foreground/60">{tool.description}</p>
        </div>
        {tool.tag && (
          <span className={`mt-auto w-fit rounded-full px-2 py-0.5 text-[11px] font-medium ${conceptColors.iconBg} ${conceptColors.icon}`}>
            {tool.tag}
          </span>
        )}
      </Link>
    </RevealOnScroll>
  );
}

function CategorySection({ category, startIndex }: { category: ToolCategory; startIndex: number }) {
  const colors = TOOL_CATEGORY_COLORS[category];
  const tools = TOOLS.filter((tool) => tool.category === category);
  if (tools.length === 0) return null;

  return (
    <RevealOnScroll className="flex w-full flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className={`h-1.5 w-1.5 rounded-full ${colors.icon.replace("text-", "bg-")}`} />
        <h2 className="text-lg font-semibold text-foreground">{category}</h2>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tools.map((tool, index) => (
          <ToolCardTile key={tool.href} tool={tool} delayMs={(startIndex + index) * STAGGER_MS} />
        ))}
      </div>
    </RevealOnScroll>
  );
}

// A pure derivation of "how many tool cards come before this category" —
// computed once at module scope (TOOL_CATEGORIES/TOOLS are both static),
// rather than mutating a counter inside the render body's map callback,
// which the React Compiler's immutability check disallows.
const CATEGORY_START_INDEX: Record<ToolCategory, number> = (() => {
  const result = {} as Record<ToolCategory, number>;
  let total = 0;
  for (const category of TOOL_CATEGORIES) {
    result[category] = total;
    total += TOOLS.filter((tool) => tool.category === category).length;
  }
  return result;
})();

export default function ToolsPage() {
  return (
    <main className="flex flex-1 flex-col items-center gap-8 p-8 pt-16 pb-16">
      <RevealOnScroll className="flex w-full max-w-5xl flex-col items-center gap-2 text-center">
        <div className="flex items-center gap-2">
          <Wrench className="text-foreground" size={26} />
          <h1 className="text-3xl font-bold text-foreground">Tools</h1>
        </div>
        <p className="max-w-xl text-sm text-foreground/50">
          A professional-grade toolkit for valuing companies, simulating long-term growth, sizing
          risk, and screening stocks.
        </p>
      </RevealOnScroll>

      <div className="flex w-full max-w-5xl flex-col gap-10">
        {TOOL_CATEGORIES.map((category) => (
          <CategorySection key={category} category={category} startIndex={CATEGORY_START_INDEX[category]} />
        ))}
      </div>

      <DisclaimerCallout>
        These calculators are educational estimation tools meant to help you understand common
        valuation and investing concepts. They are not investment advice — always do your own
        research or consult a financial professional before making investment decisions.
      </DisclaimerCallout>
    </main>
  );
}
