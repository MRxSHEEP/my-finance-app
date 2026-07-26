import type { ConceptSlug } from "./conceptVisuals";

// A 4th category beyond the 3 originally named (Valuation/Simulation/
// Screening) — Position Size Calculator is a real-time risk/sizing tool
// for an active trade, not a growth-over-time simulation or a valuation
// method, so forcing it into either would misdescribe it. Kept small and
// clearly justified rather than inventing several more categories.
export type ToolCategory = "Valuation" | "Simulation" | "Risk & Trading" | "Screening";

export const TOOL_CATEGORIES: ToolCategory[] = ["Valuation", "Simulation", "Risk & Trading", "Screening"];

export interface ToolCategoryColors {
  icon: string;
  iconBg: string;
  border: string;
  borderHover: string;
  glow: string;
}

// One accent per category, distinct from each other and from this app's
// other reserved meanings (green/red price-move, amber for "featured"
// elsewhere) — matches the "each tool category gets its own color family"
// ask, reusing the same CSS-variable-free Tailwind-utility approach as
// lib/stockCatalog.ts's own per-sector colors. This drives each card's
// border/hover-glow (category identity); the icon badge itself is colored
// per-concept instead, via lib/conceptVisuals.ts — see app/tools/page.tsx.
export const TOOL_CATEGORY_COLORS: Record<ToolCategory, ToolCategoryColors> = {
  Valuation: {
    icon: "text-blue-400",
    iconBg: "bg-blue-400/10",
    border: "border-blue-400/20",
    borderHover: "hover:border-blue-400/50",
    glow: "hover:shadow-blue-400/10",
  },
  Simulation: {
    icon: "text-indigo-400",
    iconBg: "bg-indigo-400/10",
    border: "border-indigo-400/20",
    borderHover: "hover:border-indigo-400/50",
    glow: "hover:shadow-indigo-400/10",
  },
  "Risk & Trading": {
    icon: "text-amber-400",
    iconBg: "bg-amber-400/10",
    border: "border-amber-400/20",
    borderHover: "hover:border-amber-400/50",
    glow: "hover:shadow-amber-400/10",
  },
  Screening: {
    icon: "text-purple-400",
    iconBg: "bg-purple-400/10",
    border: "border-purple-400/20",
    borderHover: "hover:border-purple-400/50",
    glow: "hover:shadow-purple-400/10",
  },
};

export interface ToolDef {
  title: string;
  description: string;
  href: string;
  category: ToolCategory;
  // Points into lib/conceptVisuals.ts's shared CONCEPT_VISUALS registry —
  // the tool's icon and accent color are looked up from there (not stored
  // here) so a concept that also has a Learning course, like DCF or PEG,
  // can never drift into a different icon/color between the two sections.
  concept: ConceptSlug;
  // A short, honest "why this matters" tag. Left undefined (not
  // fabricated) for tools where description alone already covers it, or
  // where no independently-defensible claim comes to mind — several
  // candidates were deliberately dropped here (e.g. the apocryphal
  // Einstein "8th wonder of the world" line for compound interest, which
  // is a widely disputed misattribution, not a genuine fact).
  tag?: string;
}

export const TOOLS: ToolDef[] = [
  {
    title: "DCF Calculator",
    description: "Estimate intrinsic value from projected free cash flows.",
    href: "/tools/dcf",
    category: "Valuation",
    concept: "dcf",
    tag: "The valuation method behind most professional stock analysis",
  },
  {
    title: "EBITDA Calculator",
    description: "Calculate EBITDA and, optionally, EBITDA margin.",
    href: "/tools/ebitda",
    category: "Valuation",
    concept: "ebitda",
  },
  {
    title: "EV/EBITDA Calculator",
    description: "Calculate enterprise value and the EV/EBITDA multiple.",
    href: "/tools/ev-ebitda",
    category: "Valuation",
    concept: "ev-ebitda",
  },
  {
    title: "PEG Ratio Calculator",
    description: "Compare a P/E ratio against expected earnings growth.",
    href: "/tools/peg",
    category: "Valuation",
    concept: "peg-ratio",
  },
  {
    title: "DCA Simulator",
    description: "Simulate dollar-cost averaging into a stock over time.",
    href: "/tools/dca",
    category: "Simulation",
    concept: "dca",
    tag: "Removes the pressure of timing the market",
  },
  {
    title: "Compound Interest Calculator",
    description: "Project how a lump sum and contributions grow over time.",
    href: "/tools/compound-interest",
    category: "Simulation",
    concept: "compound-interest",
  },
  {
    title: "DRIP Calculator",
    description: "Project long-term value with dividends reinvested.",
    href: "/tools/drip",
    category: "Simulation",
    concept: "drip",
    tag: "Reinvested dividends make up a large share of long-term market returns",
  },
  {
    title: "Retirement Savings Calculator",
    description: "Project your nest egg from savings, contributions, and return.",
    href: "/tools/retirement",
    category: "Simulation",
    concept: "retirement",
  },
  {
    title: "Rule of 72 Calculator",
    description: "Quickly estimate how long an investment takes to double.",
    href: "/tools/rule-of-72",
    category: "Simulation",
    concept: "rule-of-72",
    tag: "A fast mental shortcut for compounding math",
  },
  {
    title: "Position Size Calculator",
    description: "Size a trade from account risk, entry price, and stop-loss.",
    href: "/tools/position-size",
    category: "Risk & Trading",
    concept: "position-size",
    tag: "Keeps a single bad trade from doing outsized damage",
  },
  {
    title: "Stock Screener",
    description: "Filter well-known stocks by sector, valuation, and growth.",
    href: "/tools/screener",
    category: "Screening",
    concept: "screener",
  },
];
