"use client";

import { useState } from "react";
import { ChevronDown, Lightbulb, type LucideIcon } from "lucide-react";

interface HowItWorksAccordionProps {
  children: React.ReactNode;
  // Defaults match every existing Tools calculator caller exactly — only
  // Learning's "Deep dive" reuse (components/learning/ContentSlide.tsx)
  // passes these to relabel/recolor it instead of forking a near-duplicate.
  label?: string;
  icon?: LucideIcon;
  iconColorClass?: string;
}

// A compact, collapsed-by-default explainer for each calculator's
// formula/methodology — these tools are explicitly positioned as
// educational, so the "why" lives one click away rather than cluttering
// the main input/result flow for users who just want the number.
export default function HowItWorksAccordion({
  children,
  label = "How this works",
  icon: Icon = Lightbulb,
  iconColorClass = "text-amber-400",
}: HowItWorksAccordionProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="w-full max-w-2xl overflow-hidden rounded-md border border-black/10 dark:border-white/15">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 p-4 text-left text-sm font-medium text-foreground transition-colors hover:bg-foreground/5"
      >
        <span className="flex items-center gap-2">
          <Icon size={16} className={iconColorClass} /> {label}
        </span>
        <ChevronDown
          size={16}
          className={`shrink-0 text-foreground/40 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>
      <div
        className="grid transition-all duration-200 ease-out"
        style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
          <div className="flex flex-col gap-2 border-t border-black/10 p-4 text-sm leading-relaxed text-foreground/70 dark:border-white/15">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
