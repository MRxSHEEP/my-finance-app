"use client";

import { useState } from "react";
import Link from "next/link";
import { BookOpen } from "lucide-react";
import { CONCEPT_VISUALS, CONCEPT_COLOR_CLASSES } from "@/lib/conceptVisuals";
import ToolCard from "@/components/tools/ToolCard";
import NumberField from "@/components/tools/NumberField";
import AnimatedNumber from "@/components/tools/AnimatedNumber";
import HowItWorksAccordion from "@/components/tools/HowItWorksAccordion";
import LoadExampleButton from "@/components/tools/LoadExampleButton";
import DisclaimerCallout from "@/components/tools/DisclaimerCallout";
import { formatRatio, toNumber } from "@/lib/format";
import { calculatePeg, interpretPeg } from "@/lib/calculators/peg";

const EXAMPLE = { pe: "24", growth: "18" };

// The gauge scale caps at 3x — PEG values beyond that are rare/noisy and
// would just compress the meaningful 0-2 range into a sliver.
const GAUGE_MAX = 3;

function PegGauge({ peg }: { peg: number }) {
  const clamped = Math.max(0, Math.min(GAUGE_MAX, peg));
  const markerPercent = (clamped / GAUGE_MAX) * 100;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-gradient-to-r from-green-500/60 via-slate-400/40 to-red-500/60">
        <div
          className="absolute top-1/2 h-4 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground shadow"
          style={{ left: `${markerPercent}%` }}
          title={`PEG ${peg.toFixed(2)}`}
        />
      </div>
      <div className="flex justify-between text-[11px] text-foreground/50">
        <span>0 (undervalued)</span>
        <span>1</span>
        <span>2</span>
        <span>{GAUGE_MAX}+ (overvalued)</span>
      </div>
    </div>
  );
}

export default function PegCalculatorPage() {
  const [pe, setPe] = useState("");
  const [growth, setGrowth] = useState("");

  function loadExample() {
    setPe(EXAMPLE.pe);
    setGrowth(EXAMPLE.growth);
  }

  const peNum = toNumber(pe);
  const growthNum = toNumber(growth);
  const peg = calculatePeg({ pe: peNum, growth: growthNum });

  const peError = pe.trim() && peNum < 0 ? "P/E is usually positive — a negative value means negative earnings." : undefined;

  const { icon: Icon, color } = CONCEPT_VISUALS["peg-ratio"];
  const iconColorClass = CONCEPT_COLOR_CLASSES[color].icon;

  return (
    <main className="flex flex-1 flex-col items-center gap-6 p-8 pt-16">
      <div className="flex w-full max-w-2xl items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon className={iconColorClass} size={26} />
          <h1 className="text-3xl font-bold text-foreground">PEG Ratio Calculator</h1>
        </div>
        <Link
          href="/learning/peg-ratio"
          className="flex items-center gap-1 text-xs text-foreground/60 hover:text-foreground hover:underline"
        >
          <BookOpen size={12} /> Learn about PEG Ratio
        </Link>
      </div>

      <ToolCard title="Inputs">
        <div className="mb-4 flex items-center justify-between">
          <span className="text-xs text-foreground/50">Updates live as you type.</span>
          <LoadExampleButton onClick={loadExample} />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <NumberField
            label="P/E Ratio"
            value={pe}
            onChange={setPe}
            error={peError}
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
            {peg !== null ? <AnimatedNumber value={peg} format={(v) => formatRatio(v)} /> : "—"}
          </dd>
        </dl>
        {peg !== null && (
          <div className="mt-4">
            <PegGauge peg={peg} />
          </div>
        )}
        {peg !== null && <p className="mt-3 text-foreground/60">{interpretPeg(peg)}</p>}
        <p className="mt-3 text-xs text-foreground/60">
          Rough rule of thumb only — a PEG below 1 may suggest undervaluation and above 2 may
          suggest overvaluation, but this varies a lot by sector and growth stage.
        </p>
      </ToolCard>

      <HowItWorksAccordion>
        <p>
          The <strong>PEG ratio</strong> (P/E ÷ expected earnings growth rate) extends the P/E
          ratio by accounting for growth — a high P/E can be perfectly reasonable if earnings are
          growing quickly, and a low P/E can still be expensive if earnings are barely growing at
          all.
        </p>
        <p>
          A PEG of 1 is the traditional &quot;fairly valued&quot; reference point, popularized by Peter
          Lynch: the stock&apos;s valuation roughly matches its growth rate.
        </p>
      </HowItWorksAccordion>

      <DisclaimerCallout>
        This is an educational estimation tool, not investment advice. Growth expectations are
        inherently uncertain, and PEG works best comparing similar companies in the same industry
        and growth stage — not as an absolute cutoff.
      </DisclaimerCallout>
    </main>
  );
}
