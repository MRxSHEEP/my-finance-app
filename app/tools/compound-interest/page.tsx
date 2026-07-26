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
  principal: "10000",
  monthlyContribution: "300",
  rate: "7",
  years: "25",
};

export default function CompoundInterestPage() {
  const [principal, setPrincipal] = useState("10000");
  const [monthlyContribution, setMonthlyContribution] = useState("0");
  const [rate, setRate] = useState("7");
  const [years, setYears] = useState("20");

  function loadExample() {
    setPrincipal(EXAMPLE.principal);
    setMonthlyContribution(EXAMPLE.monthlyContribution);
    setRate(EXAMPLE.rate);
    setYears(EXAMPLE.years);
  }

  const principalNum = toNumber(principal);
  const contributionNum = toNumber(monthlyContribution);
  const rateNum = toNumber(rate);
  const yearsRaw = Math.round(toNumber(years));
  const yearsNum = Math.max(1, Math.min(60, yearsRaw || 20));

  const principalError = principal.trim() && principalNum < 0 ? "Can't be negative." : undefined;
  const contributionError =
    monthlyContribution.trim() && contributionNum < 0 ? "Can't be negative." : undefined;
  const yearsError = years.trim() && (yearsRaw < 1 || yearsRaw > 60) ? "Must be between 1 and 60 years." : undefined;

  const monthlyRate = rateNum / 100 / 12;
  const chartData: GrowthProjectionPoint[] = [];
  let balance = principalNum;
  let contributed = principalNum;
  chartData.push({ year: 0, balance, contributed });

  for (let year = 1; year <= yearsNum; year++) {
    for (let month = 0; month < 12; month++) {
      balance = balance * (1 + monthlyRate) + contributionNum;
      contributed += contributionNum;
    }
    chartData.push({ year, balance, contributed });
  }

  const finalBalance = chartData[chartData.length - 1]?.balance ?? principalNum;
  const totalContributed = chartData[chartData.length - 1]?.contributed ?? principalNum;
  const totalGrowth = finalBalance - totalContributed;

  const { icon: Icon, color } = CONCEPT_VISUALS["compound-interest"];
  const iconColorClass = CONCEPT_COLOR_CLASSES[color].icon;

  return (
    <main className="flex flex-1 flex-col items-center gap-6 p-8 pt-16">
      <div className="flex items-center gap-2">
        <Icon className={iconColorClass} size={26} />
        <h1 className="text-3xl font-bold text-foreground">Compound Interest Calculator</h1>
      </div>

      <ToolCard title="Inputs">
        <div className="mb-4 flex items-center justify-between">
          <span className="text-xs text-foreground/50">Updates live as you type.</span>
          <LoadExampleButton onClick={loadExample} />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <NumberField
            label="Initial Amount"
            prefix="$"
            value={principal}
            onChange={setPrincipal}
            error={principalError}
            helperText="The lump sum you're starting with."
          />
          <NumberField
            label="Monthly Contribution"
            prefix="$"
            value={monthlyContribution}
            onChange={setMonthlyContribution}
            error={contributionError}
            helperText="Optional — how much you add each month."
          />
          <NumberField
            label="Annual Growth Rate"
            suffix="%"
            value={rate}
            onChange={setRate}
            helperText="Expected average annual return."
          />
          <NumberField
            label="Years"
            value={years}
            onChange={setYears}
            error={yearsError}
            helperText="How many years to project growth (1-60)."
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
          <dt className="font-semibold text-foreground">Projected Balance</dt>
          <dd className="text-right font-semibold text-foreground">
            <AnimatedNumber value={finalBalance} format={(v) => formatCurrency(v, 0)} />
          </dd>
        </dl>

        <div className="mt-4 h-64 w-full">
          <GrowthProjectionChart data={chartData} />
        </div>
      </ToolCard>

      <HowItWorksAccordion>
        <p>
          Compound interest grows a balance by applying the growth rate not just to your original
          principal, but to all the growth that&apos;s already accumulated — each month&apos;s
          balance earns on top of every previous month&apos;s gains, not just the initial amount.
        </p>
        <p>
          This projection compounds monthly: each month, the balance grows by{" "}
          <code>annual rate ÷ 12</code>, then your monthly contribution is added on top, repeated
          for the full number of years.
        </p>
      </HowItWorksAccordion>

      <DisclaimerCallout>
        This is an educational estimation tool, not investment advice. It assumes a constant
        annual return, which real investments never actually deliver year to year — markets go up
        and down, and this is meant to illustrate the mechanics of compounding, not predict an
        outcome.
      </DisclaimerCallout>
    </main>
  );
}
