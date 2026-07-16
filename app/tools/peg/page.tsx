"use client";

import { useState } from "react";
import ToolCard from "@/components/tools/ToolCard";
import NumberField from "@/components/tools/NumberField";
import { formatRatio, toNumber } from "@/lib/format";

function interpretPeg(peg: number): string {
  if (peg <= 0) return "Not meaningful (requires positive P/E and growth rate).";
  if (peg < 1) return "< 1: potentially undervalued relative to expected growth.";
  if (peg <= 2) return "1-2: roughly fairly valued relative to expected growth.";
  return "> 2: potentially overvalued relative to expected growth.";
}

export default function PegCalculatorPage() {
  const [pe, setPe] = useState("");
  const [growth, setGrowth] = useState("");

  const peNum = toNumber(pe);
  const growthNum = toNumber(growth);
  const peg = growthNum !== 0 ? peNum / growthNum : null;

  return (
    <main className="flex flex-1 flex-col items-center gap-6 p-8 pt-16">
      <h1 className="text-3xl font-bold text-foreground">PEG Ratio Calculator</h1>

      <ToolCard title="Inputs">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <NumberField
            label="P/E Ratio"
            value={pe}
            onChange={setPe}
            helperText="Price-to-earnings ratio — share price divided by earnings per share."
          />
          <NumberField
            label="Expected EPS Growth Rate"
            suffix="%"
            value={growth}
            onChange={setGrowth}
            helperText="Expected annual growth rate of earnings per share."
          />
        </div>
      </ToolCard>

      <ToolCard title="Result">
        <dl className="grid grid-cols-2 gap-y-2">
          <dt className="font-semibold text-foreground">PEG Ratio</dt>
          <dd className="text-right font-semibold text-foreground">
            {peg !== null ? formatRatio(peg) : "—"}
          </dd>
        </dl>
        {peg !== null && <p className="mt-3 text-foreground/60">{interpretPeg(peg)}</p>}
        <p className="mt-3 text-xs text-foreground/60">
          Rough rule of thumb only — a PEG below 1 may suggest undervaluation and above 2 may
          suggest overvaluation, but this varies a lot by sector and growth stage.
        </p>
      </ToolCard>

      <p className="w-full max-w-2xl text-xs text-foreground/60">
        This is an educational estimation tool, not investment advice.
      </p>
    </main>
  );
}
