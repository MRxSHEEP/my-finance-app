"use client";

import { useId } from "react";
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCompactCurrency } from "@/lib/format";

export interface GrowthProjectionPoint {
  year: number;
  balance: number;
  // Cumulative principal/contributions only (no growth) — plotted as a
  // reference line so the gap between it and the balance area visually
  // reads as "this much came from growth, not from money you put in."
  contributed: number;
}

function GrowthTooltipContent({
  active,
  payload,
  label,
}: {
  active?: boolean;
  label?: number;
  payload?: Array<{ payload: GrowthProjectionPoint }>;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0].payload;
  const growth = point.balance - point.contributed;

  return (
    <div className="rounded-md border border-black/10 bg-background/95 px-3 py-2 text-xs shadow-lg ring-1 ring-black/5 backdrop-blur-sm dark:border-white/15 dark:ring-white/10">
      <p className="mb-1 font-semibold text-foreground">Year {label}</p>
      <p className="text-foreground/70">
        Balance: <span className="font-medium text-foreground">{formatCompactCurrency(point.balance)}</span>
      </p>
      <p className="text-foreground/70">
        Contributed: <span className="font-medium text-foreground">{formatCompactCurrency(point.contributed)}</span>
      </p>
      <p className="mt-1 text-foreground/50">
        Growth: <span className="font-medium text-green-500">{formatCompactCurrency(growth)}</span>
      </p>
    </div>
  );
}

// Shared by every "project a balance forward N years" tool (Compound
// Interest, Retirement Savings, DRIP) — a gradient-filled area for the
// total balance plus a dashed reference line for principal/contributions
// alone, so growth-from-returns is visually obvious rather than a single
// flat number at the end.
export default function GrowthProjectionChart({ data }: { data: GrowthProjectionPoint[] }) {
  const uid = useId().replace(/:/g, "");
  const gradientId = `growth-${uid}`;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#22c55e" stopOpacity={0.35} />
            <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
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
        <Tooltip content={<GrowthTooltipContent />} />
        <Area
          type="monotone"
          dataKey="balance"
          stroke="#22c55e"
          strokeWidth={2}
          fill={`url(#${gradientId})`}
          isAnimationActive
          animationDuration={700}
        />
        <Line
          type="monotone"
          dataKey="contributed"
          stroke="#94a3b8"
          strokeWidth={1.5}
          strokeDasharray="4 3"
          dot={false}
          isAnimationActive
          animationDuration={700}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
