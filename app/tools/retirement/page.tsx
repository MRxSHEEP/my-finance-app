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
import { formatCurrency, toNumber } from "@/lib/format";

const EXAMPLE = {
  currentSavings: "35000",
  monthlyContribution: "800",
  rate: "7",
  yearsToRetirement: "30",
};

// Bengen's widely-cited "4% rule" — a common starting-point heuristic for
// how much can be withdrawn annually from a nest egg without depleting it
// over a ~30-year retirement. Presented as a rough heuristic, not a
// guarantee (see the disclaimer below).
const SAFE_WITHDRAWAL_RATE = 0.04;

export default function RetirementCalculatorPage() {
  const [currentSavings, setCurrentSavings] = useState("20000");
  const [monthlyContribution, setMonthlyContribution] = useState("500");
  const [rate, setRate] = useState("7");
  const [yearsToRetirement, setYearsToRetirement] = useState("30");

  function loadExample() {
    setCurrentSavings(EXAMPLE.currentSavings);
    setMonthlyContribution(EXAMPLE.monthlyContribution);
    setRate(EXAMPLE.rate);
    setYearsToRetirement(EXAMPLE.yearsToRetirement);
  }

  const savingsNum = toNumber(currentSavings);
  const contributionNum = toNumber(monthlyContribution);
  const rateNum = toNumber(rate);
  const yearsRaw = Math.round(toNumber(yearsToRetirement));
  const yearsNum = Math.max(1, Math.min(60, yearsRaw || 30));

  const savingsError = currentSavings.trim() && savingsNum < 0 ? "Can't be negative." : undefined;
  const contributionError =
    monthlyContribution.trim() && contributionNum < 0 ? "Can't be negative." : undefined;
  const yearsError =
    yearsToRetirement.trim() && (yearsRaw < 1 || yearsRaw > 60) ? "Must be between 1 and 60 years." : undefined;

  const monthlyRate = rateNum / 100 / 12;
  const chartData: GrowthProjectionPoint[] = [];
  let balance = savingsNum;
  let contributed = savingsNum;
  chartData.push({ year: 0, balance, contributed });

  for (let year = 1; year <= yearsNum; year++) {
    for (let month = 0; month < 12; month++) {
      balance = balance * (1 + monthlyRate) + contributionNum;
      contributed += contributionNum;
    }
    chartData.push({ year, balance, contributed });
  }

  const nestEgg = chartData[chartData.length - 1]?.balance ?? savingsNum;
  const totalContributed = chartData[chartData.length - 1]?.contributed ?? savingsNum;
  const totalGrowth = nestEgg - totalContributed;
  const annualIncome = nestEgg * SAFE_WITHDRAWAL_RATE;
  const monthlyIncome = annualIncome / 12;

  const { icon: Icon, color } = CONCEPT_VISUALS.retirement;
  const iconColorClass = CONCEPT_COLOR_CLASSES[color].icon;

  return (
    <main className="flex flex-1 flex-col items-center gap-6 p-8 pt-16">
      <div className="flex items-center gap-2">
        <Icon className={iconColorClass} size={26} />
        <h1 className="text-3xl font-bold text-foreground">Retirement Savings Calculator</h1>
      </div>

      <ToolCard title="Inputs">
        <div className="mb-4 flex items-center justify-between">
          <span className="text-xs text-foreground/50">Updates live as you type.</span>
          <LoadExampleButton onClick={loadExample} />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <NumberField
            label="Current Savings"
            prefix="$"
            value={currentSavings}
            onChange={setCurrentSavings}
            error={savingsError}
            helperText="What you already have saved toward retirement."
          />
          <NumberField
            label="Monthly Contribution"
            prefix="$"
            value={monthlyContribution}
            onChange={setMonthlyContribution}
            error={contributionError}
            helperText="How much you plan to add each month."
          />
          <NumberField
            label="Expected Annual Return"
            suffix="%"
            value={rate}
            onChange={setRate}
            helperText="Long-run average return assumption for your investments."
          />
          <NumberField
            label="Years to Retirement"
            value={yearsToRetirement}
            onChange={setYearsToRetirement}
            error={yearsError}
            helperText="How many years until you plan to retire (1-60)."
          />
        </div>
      </ToolCard>

      <ToolCard title="Result">
        <dl className="grid grid-cols-2 gap-y-2">
          <dt className="text-foreground/60">Total Contributed</dt>
          <dd className="text-right">
            <AnimatedNumber value={totalContributed} format={(v) => formatCurrency(v, 0)} />
          </dd>
          <dt className="text-foreground/60">Total Growth</dt>
          <dd className="text-right text-green-500">
            <AnimatedNumber value={totalGrowth} format={(v) => formatCurrency(v, 0)} />
          </dd>
          <dt className="font-semibold text-foreground">Projected Nest Egg</dt>
          <dd className="text-right font-semibold text-foreground">
            <AnimatedNumber value={nestEgg} format={(v) => formatCurrency(v, 0)} />
          </dd>
        </dl>

        <div className="mt-4 h-64 w-full">
          <GrowthProjectionChart data={chartData} />
        </div>

        <div className="mt-4 rounded-md bg-foreground/5 p-3 text-sm">
          <p className="text-foreground/70">
            Using the widely-cited{" "}
            <span className="font-medium text-foreground">4% rule</span> as a rough starting-point
            heuristic:
          </p>
          <dl className="mt-2 grid grid-cols-2 gap-y-1">
            <dt className="text-foreground/60">Estimated Annual Income</dt>
            <dd className="text-right font-medium text-foreground">
              <AnimatedNumber value={annualIncome} format={(v) => formatCurrency(v, 0)} />
            </dd>
            <dt className="text-foreground/60">Estimated Monthly Income</dt>
            <dd className="text-right font-medium text-foreground">
              <AnimatedNumber value={monthlyIncome} format={(v) => formatCurrency(v, 0)} />
            </dd>
          </dl>
        </div>
      </ToolCard>

      <HowItWorksAccordion>
        <p>
          This projects your current savings plus monthly contributions forward at a constant
          assumed annual return, compounding monthly — the same mechanics as the Compound Interest
          Calculator, framed around a retirement timeline.
        </p>
        <p>
          The <strong>4% rule</strong> (based on William Bengen&apos;s research) is a common
          heuristic suggesting a retiree can withdraw about 4% of their nest egg in the first year
          of retirement, adjusting for inflation thereafter, with a reasonable chance of not
          running out of money over a ~30-year retirement. It&apos;s a starting point for
          discussion, not a guarantee.
        </p>
      </HowItWorksAccordion>

      <DisclaimerCallout>
        This is an educational estimation tool, not investment advice or retirement planning
        advice. It assumes a constant return and ignores inflation, taxes, Social Security, and
        sequence-of-returns risk — all of which materially affect real retirement outcomes.
        Consult a financial professional for actual retirement planning.
      </DisclaimerCallout>
    </main>
  );
}
