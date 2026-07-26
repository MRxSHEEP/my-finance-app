import type { LucideIcon } from "lucide-react";
import {
  Scale,
  TrendingUp,
  Divide,
  Layers,
  BarChart3,
  LineChart,
  Landmark,
  Banknote,
  Gauge,
  Star,
  Eye,
  Repeat,
  Sprout,
  RefreshCw,
  PiggyBank,
  Timer,
  Target,
  Filter,
} from "lucide-react";

// The single shared registry of {icon, color} per financial concept —
// imported by both the Learning section (components/learning/TopicCard.tsx)
// and the Tools section (lib/toolsMeta.ts, app/tools/page.tsx, and each
// individual calculator page's header) so a concept appearing in both
// places never drifts into two different icons/colors again, the way DCF
// (LineChart/blue in Tools vs. LineChart/pink in Learning), EV/EBITDA
// (Scale vs. BarChart3), and PEG (Gauge vs. TrendingUp) previously had.
//
// Concepts with a Learning course but no Tools calculator yet (P/E, EPS,
// Market Cap, Dividend Yield, Beta, Analyst Ratings, Insider Trading) keep
// their existing Learning-only icon/color untouched here — nothing on the
// Tools side references them. Concepts with a Tools calculator but no
// Learning course yet (Compound Interest, DRIP, Retirement, Rule of 72,
// Position Size, Screener) get their own entries following the same
// pattern, so a future Learning course for any of them picks up the same
// identity automatically instead of the two sections diverging again.
export type ConceptSlug =
  | "pe-ratio"
  | "peg-ratio"
  | "eps"
  | "ebitda"
  | "ev-ebitda"
  | "dcf"
  | "market-cap"
  | "dividend-yield"
  | "beta"
  | "analyst-ratings"
  | "insider-trading"
  | "dca"
  | "compound-interest"
  | "drip"
  | "retirement"
  | "rule-of-72"
  | "position-size"
  | "screener";

export type ConceptColor =
  | "blue"
  | "green"
  | "purple"
  | "orange"
  | "teal"
  | "pink"
  | "amber"
  | "emerald"
  | "rose"
  | "indigo"
  | "cyan"
  | "sky"
  | "red"
  | "yellow"
  | "lime"
  | "violet"
  | "fuchsia";

export interface ConceptVisual {
  icon: LucideIcon;
  color: ConceptColor;
}

export const CONCEPT_VISUALS: Record<ConceptSlug, ConceptVisual> = {
  "pe-ratio": { icon: Scale, color: "blue" },
  "peg-ratio": { icon: TrendingUp, color: "green" },
  eps: { icon: Divide, color: "purple" },
  ebitda: { icon: Layers, color: "orange" },
  "ev-ebitda": { icon: BarChart3, color: "teal" },
  dcf: { icon: LineChart, color: "pink" },
  "market-cap": { icon: Landmark, color: "amber" },
  "dividend-yield": { icon: Banknote, color: "emerald" },
  beta: { icon: Gauge, color: "rose" },
  "analyst-ratings": { icon: Star, color: "indigo" },
  "insider-trading": { icon: Eye, color: "cyan" },
  dca: { icon: Repeat, color: "sky" },
  "compound-interest": { icon: Sprout, color: "lime" },
  drip: { icon: RefreshCw, color: "violet" },
  retirement: { icon: PiggyBank, color: "fuchsia" },
  "rule-of-72": { icon: Timer, color: "yellow" },
  "position-size": { icon: Target, color: "red" },
  // Purple, not a fresh hue — this matches the Screening category's own
  // accent (already used throughout app/tools/screener/page.tsx for the
  // filter panel border and save-filter button), and Stock Screener is the
  // only tool in that category, so reusing it creates no collision.
  screener: { icon: Filter, color: "purple" },
};

interface ConceptColorClasses {
  icon: string;
  iconBg: string;
  iconRing: string;
  border: string;
  hoverBorder: string;
  hoverShadow: string;
  stroke: string;
}

// Full Tailwind class names throughout, not built via string
// interpolation — the JIT compiler needs to see complete class names
// statically at build time, it can't detect `text-${color}-400`.
export const CONCEPT_COLOR_CLASSES: Record<ConceptColor, ConceptColorClasses> = {
  blue: {
    icon: "text-blue-400",
    iconBg: "bg-blue-400/10",
    iconRing: "ring-blue-400/30",
    border: "border-blue-400/20",
    hoverBorder: "hover:border-blue-400/50",
    hoverShadow: "hover:shadow-blue-400/20",
    stroke: "stroke-blue-400",
  },
  green: {
    icon: "text-green-400",
    iconBg: "bg-green-400/10",
    iconRing: "ring-green-400/30",
    border: "border-green-400/20",
    hoverBorder: "hover:border-green-400/50",
    hoverShadow: "hover:shadow-green-400/20",
    stroke: "stroke-green-400",
  },
  purple: {
    icon: "text-purple-400",
    iconBg: "bg-purple-400/10",
    iconRing: "ring-purple-400/30",
    border: "border-purple-400/20",
    hoverBorder: "hover:border-purple-400/50",
    hoverShadow: "hover:shadow-purple-400/20",
    stroke: "stroke-purple-400",
  },
  orange: {
    icon: "text-orange-400",
    iconBg: "bg-orange-400/10",
    iconRing: "ring-orange-400/30",
    border: "border-orange-400/20",
    hoverBorder: "hover:border-orange-400/50",
    hoverShadow: "hover:shadow-orange-400/20",
    stroke: "stroke-orange-400",
  },
  teal: {
    icon: "text-teal-400",
    iconBg: "bg-teal-400/10",
    iconRing: "ring-teal-400/30",
    border: "border-teal-400/20",
    hoverBorder: "hover:border-teal-400/50",
    hoverShadow: "hover:shadow-teal-400/20",
    stroke: "stroke-teal-400",
  },
  pink: {
    icon: "text-pink-400",
    iconBg: "bg-pink-400/10",
    iconRing: "ring-pink-400/30",
    border: "border-pink-400/20",
    hoverBorder: "hover:border-pink-400/50",
    hoverShadow: "hover:shadow-pink-400/20",
    stroke: "stroke-pink-400",
  },
  amber: {
    icon: "text-amber-400",
    iconBg: "bg-amber-400/10",
    iconRing: "ring-amber-400/30",
    border: "border-amber-400/20",
    hoverBorder: "hover:border-amber-400/50",
    hoverShadow: "hover:shadow-amber-400/20",
    stroke: "stroke-amber-400",
  },
  emerald: {
    icon: "text-emerald-400",
    iconBg: "bg-emerald-400/10",
    iconRing: "ring-emerald-400/30",
    border: "border-emerald-400/20",
    hoverBorder: "hover:border-emerald-400/50",
    hoverShadow: "hover:shadow-emerald-400/20",
    stroke: "stroke-emerald-400",
  },
  rose: {
    icon: "text-rose-400",
    iconBg: "bg-rose-400/10",
    iconRing: "ring-rose-400/30",
    border: "border-rose-400/20",
    hoverBorder: "hover:border-rose-400/50",
    hoverShadow: "hover:shadow-rose-400/20",
    stroke: "stroke-rose-400",
  },
  indigo: {
    icon: "text-indigo-400",
    iconBg: "bg-indigo-400/10",
    iconRing: "ring-indigo-400/30",
    border: "border-indigo-400/20",
    hoverBorder: "hover:border-indigo-400/50",
    hoverShadow: "hover:shadow-indigo-400/20",
    stroke: "stroke-indigo-400",
  },
  cyan: {
    icon: "text-cyan-400",
    iconBg: "bg-cyan-400/10",
    iconRing: "ring-cyan-400/30",
    border: "border-cyan-400/20",
    hoverBorder: "hover:border-cyan-400/50",
    hoverShadow: "hover:shadow-cyan-400/20",
    stroke: "stroke-cyan-400",
  },
  sky: {
    icon: "text-sky-400",
    iconBg: "bg-sky-400/10",
    iconRing: "ring-sky-400/30",
    border: "border-sky-400/20",
    hoverBorder: "hover:border-sky-400/50",
    hoverShadow: "hover:shadow-sky-400/20",
    stroke: "stroke-sky-400",
  },
  red: {
    icon: "text-red-400",
    iconBg: "bg-red-400/10",
    iconRing: "ring-red-400/30",
    border: "border-red-400/20",
    hoverBorder: "hover:border-red-400/50",
    hoverShadow: "hover:shadow-red-400/20",
    stroke: "stroke-red-400",
  },
  yellow: {
    icon: "text-yellow-400",
    iconBg: "bg-yellow-400/10",
    iconRing: "ring-yellow-400/30",
    border: "border-yellow-400/20",
    hoverBorder: "hover:border-yellow-400/50",
    hoverShadow: "hover:shadow-yellow-400/20",
    stroke: "stroke-yellow-400",
  },
  lime: {
    icon: "text-lime-400",
    iconBg: "bg-lime-400/10",
    iconRing: "ring-lime-400/30",
    border: "border-lime-400/20",
    hoverBorder: "hover:border-lime-400/50",
    hoverShadow: "hover:shadow-lime-400/20",
    stroke: "stroke-lime-400",
  },
  violet: {
    icon: "text-violet-400",
    iconBg: "bg-violet-400/10",
    iconRing: "ring-violet-400/30",
    border: "border-violet-400/20",
    hoverBorder: "hover:border-violet-400/50",
    hoverShadow: "hover:shadow-violet-400/20",
    stroke: "stroke-violet-400",
  },
  fuchsia: {
    icon: "text-fuchsia-400",
    iconBg: "bg-fuchsia-400/10",
    iconRing: "ring-fuchsia-400/30",
    border: "border-fuchsia-400/20",
    hoverBorder: "hover:border-fuchsia-400/50",
    hoverShadow: "hover:shadow-fuchsia-400/20",
    stroke: "stroke-fuchsia-400",
  },
};
