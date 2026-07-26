"use client";

import { useState } from "react";
import { CONCEPT_VISUALS, CONCEPT_COLOR_CLASSES } from "@/lib/conceptVisuals";
import ToolCard from "@/components/tools/ToolCard";
import NumberField from "@/components/tools/NumberField";
import AnimatedNumber from "@/components/tools/AnimatedNumber";
import GrowthProjectionChart, { type GrowthProjectionPoint } from "@/components/tools/GrowthProjectionChart";
import HowItWorksAccordion from "@/components/tools/HowItWorksAccordion";
import LoadExampleButton from "@/components/tools/LoadExampleButton";
import DisclaimerCallout from "@/components/tools/DisclaimerCallout";
import { toNumber } from "@/lib/format";

const EXAMPLE = { rate: "8" };

function formatYears(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "—";
  return `${value.toFixed(1)} years`;
}

export default function RuleOf72Page() {
  const [rate, setRate] = useState("");

  function loadExample() {
    setRate(EXAMPLE.rate);
  }

  const rateNum = toNumber(rate);
  const rateError = rate.trim() && rateNum <= 0 ? "Must be a positive rate." : undefined;

  const ruleOf72Years = rateNum > 0 ? 72 / rateNum : null;
  // The precise doubling time, for comparison — Rule of 72 is a fast
  // approximation of this, most accurate in the 6-10% range.
  const exactYears = rateNum > 0 ? Math.log(2) / Math.log(1 + rateNum / 100) : null;

  const chartData: GrowthProjectionPoint[] = [];
  if (exactYears !== null && exactYears > 0) {
    const wholeYears = Math.max(1, Math.ceil(exactYears));
    for (let year = 0; year <= wholeYears; year++) {
      chartData.push({
        year,
        balance: Math.pow(1 + rateNum / 100, year),
        contributed: 1,
      });
    }
  }

  const { icon: Icon, color } = CONCEPT_VISUALS["rule-of-72"];
  const iconColorClass = CONCEPT_COLOR_CLASSES[color].icon;

  return (
    <main className="flex flex-1 flex-col items-center gap-6 p-8 pt-16">
      <div className="flex items-center gap-2">
        <Icon className={iconColorClass} size={26} />
        <h1 className="text-3xl font-bold text-foreground">Rule of 72 Calculator</h1>
      </div>

      <ToolCard title="Inputs">
        <div className="mb-4 flex items-center justify-between">
          <span className="text-xs text-foreground/50">Updates live as you type.</span>
          <LoadExampleButton onClick={loadExample} />
        </div>
        <NumberField
          label="Annual Growth Rate"
          suffix="%"
          value={rate}
          onChange={setRate}
          error={rateError}
          helperText="Expected annual return or interest rate."
        />
      </ToolCard>

      {ruleOf72Years !== null && (
        <ToolCard title="Result">
          <dl className="grid grid-cols-2 gap-y-2">
            <dt className="font-semibold text-foreground">Doubling Time (Rule of 72)</dt>
            <dd className="text-right font-semibold text-foreground">
              <AnimatedNumber value={ruleOf72Years} format={formatYears} />
            </dd>
            <dt className="text-foreground/60">Exact Doubling Time</dt>
            <dd className="text-right">
              <AnimatedNumber value={exactYears ?? 0} format={formatYears} />
            </dd>
          </dl>

          {chartData.length > 1 && (
            <div className="mt-4 h-56 w-full">
              <GrowthProjectionChart data={chartData} />
            </div>
          )}
        </ToolCard>
      )}

      <HowItWorksAccordion>
        <p>
          The Rule of 72 is a mental-math shortcut: divide 72 by an annual growth rate to estimate
          how many years it takes an investment to double. At 8% annual growth, that&apos;s{" "}
          <code>72 ÷ 8 = 9</code> years.
        </p>
        <p>
          The exact answer comes from solving <code>(1 + rate)^years = 2</code> for years, i.e.{" "}
          <code>ln(2) / ln(1 + rate)</code>. The Rule of 72 approximation is most accurate for
          rates roughly between 6% and 10%, and drifts a bit further from exact outside that range.
        </p>
      </HowItWorksAccordion>

      <DisclaimerCallout>
        This is an educational estimation tool, not investment advice. Real returns fluctuate
        year to year rather than compounding at a single fixed rate.
      </DisclaimerCallout>
    </main>
  );
}
