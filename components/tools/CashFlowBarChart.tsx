"use client";

import { useId } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCompactCurrency } from "@/lib/format";

interface CashFlowPoint {
  year: number;
  projectedFcf: number;
  presentValue: number;
}

function CashFlowTooltipContent({
  active,
  payload,
  label,
}: {
  active?: boolean;
  label?: number;
  payload?: Array<{ payload: CashFlowPoint }>;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0].payload;

  return (
    <div className="rounded-md border border-black/10 bg-background/95 px-3 py-2 text-xs shadow-lg ring-1 ring-black/5 backdrop-blur-sm dark:border-white/15 dark:ring-white/10">
      <p className="mb-1 font-semibold text-foreground">Year {label}</p>
      <p className="text-foreground/70">
        Projected FCF: <span className="font-medium text-foreground">{formatCompactCurrency(point.projectedFcf)}</span>
      </p>
      <p className="text-foreground/70">
        Present Value: <span className="font-medium text-blue-400">{formatCompactCurrency(point.presentValue)}</span>
      </p>
    </div>
  );
}

// Grouped bars (not stacked — the two series describe the same year's cash
// flow two ways, not two parts of a whole) with a two-stop gradient per
// series, matching the richer chart-gradient treatment used elsewhere in
// the app's recent visual passes (e.g. EarningsCard's own beat/miss bars).
export default function CashFlowBarChart({ data }: { data: CashFlowPoint[] }) {
  const uid = useId().replace(/:/g, "");
  const fcfGradientId = `dcf-fcf-${uid}`;
  const pvGradientId = `dcf-pv-${uid}`;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data}>
        <defs>
          <linearGradient id={fcfGradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#94a3b8" stopOpacity={0.9} />
            <stop offset="100%" stopColor="#64748b" stopOpacity={0.6} />
          </linearGradient>
          <linearGradient id={pvGradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#60a5fa" stopOpacity={0.95} />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.7} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.06} />
        <XAxis
          dataKey="year"
          tickFormatter={(year) => `Y${year}`}
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={{ opacity: 0.15 }}
        />
        <YAxis
          tickFormatter={(value) => formatCompactCurrency(Number(value))}
          tick={{ fontSize: 11 }}
          width={56}
          tickLine={false}
          axisLine={{ opacity: 0.15 }}
        />
        <Tooltip content={<CashFlowTooltipContent />} cursor={{ fill: "rgba(148,163,184,0.08)" }} />
        <Bar dataKey="projectedFcf" name="Projected FCF" fill={`url(#${fcfGradientId})`} radius={[3, 3, 0, 0]} />
        <Bar dataKey="presentValue" name="Present Value" fill={`url(#${pvGradientId})`} radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
