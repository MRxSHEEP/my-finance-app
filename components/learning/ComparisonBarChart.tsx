"use client";

import { useId } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ConceptColor } from "@/lib/conceptVisuals";
import type { ComparisonBarSpec } from "@/lib/learning/types";

// Standard Tailwind -400 hex values for each ConceptColor — recharts fills
// are raw SVG attributes, so the Tailwind class names CONCEPT_COLOR_CLASSES
// exposes elsewhere can't be used directly here the way a DOM component can.
const HEX_BY_COLOR: Record<ConceptColor, string> = {
  blue: "#60a5fa",
  green: "#4ade80",
  purple: "#c084fc",
  orange: "#fb923c",
  teal: "#2dd4bf",
  pink: "#f472b6",
  amber: "#fbbf24",
  emerald: "#34d399",
  rose: "#fb7185",
  indigo: "#818cf8",
  cyan: "#22d3ee",
  sky: "#38bdf8",
  red: "#f87171",
  yellow: "#facc15",
  lime: "#a3e635",
  violet: "#a78bfa",
  fuchsia: "#e879f9",
};

// A "notable outlier" bar (e.g. a real historical example called out
// alongside a set of typical figures) gets this fixed contrasting color
// instead of the series' own hue — signals "this one is different" the
// same way a status color would, rather than expanding into a categorical
// palette for what's still fundamentally one series/one metric.
const HIGHLIGHT_HEX = "#f87171";

function ComparisonTooltipContent({
  active,
  payload,
  unit,
}: {
  active?: boolean;
  payload?: Array<{ payload: { label: string; value: number; highlight?: boolean } }>;
  unit?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0].payload;
  return (
    <div className="rounded-md border border-black/10 bg-background/95 px-3 py-2 text-xs shadow-lg ring-1 ring-black/5 backdrop-blur-sm dark:border-white/15 dark:ring-white/10">
      <p className="font-semibold text-foreground">{point.label}</p>
      <p className="text-foreground/70">
        {point.value.toLocaleString()}
        {unit ?? ""}
        {point.highlight && <span className="ml-1 text-red-400">(historical example)</span>}
      </p>
    </div>
  );
}

// A single-series magnitude comparison across categorical entities (e.g.
// P/E ratio across a handful of companies) — one hue per the dataviz
// convention for a single metric, not a categorical rainbow, with an
// optional highlighted bar in a fixed contrasting color for a called-out
// historical example rather than a typical/illustrative figure.
export default function ComparisonBarChart({ spec, color }: { spec: ComparisonBarSpec; color: ConceptColor }) {
  const uid = useId().replace(/:/g, "");
  const gradientId = `cmp-${uid}`;
  const hex = HEX_BY_COLOR[color];

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-medium text-foreground/70">{spec.title}</p>
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={spec.bars}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={hex} stopOpacity={0.95} />
                <stop offset="100%" stopColor={hex} stopOpacity={0.55} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.06} />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={{ opacity: 0.15 }} />
            <YAxis
              tickFormatter={(value) => `${value}${spec.unit ?? ""}`}
              tick={{ fontSize: 11 }}
              width={48}
              tickLine={false}
              axisLine={{ opacity: 0.15 }}
            />
            <Tooltip content={<ComparisonTooltipContent unit={spec.unit} />} cursor={{ fill: "rgba(148,163,184,0.08)" }} />
            <Bar dataKey="value" radius={[3, 3, 0, 0]}>
              {spec.bars.map((bar, index) => (
                <Cell key={index} fill={bar.highlight ? HIGHLIGHT_HEX : `url(#${gradientId})`} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
