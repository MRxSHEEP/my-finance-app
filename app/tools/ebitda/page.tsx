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
import { formatCompactCurrency, formatPercent, toNumber } from "@/lib/format";
import { calculateEbitda } from "@/lib/calculators/ebitda";

const EXAMPLE = {
  netIncome: "50000000",
  interest: "10000000",
  taxes: "15000000",
  depreciation: "18000000",
  amortization: "7000000",
  revenue: "500000000",
};

const COMPOSITION_SEGMENTS: Array<{ key: keyof typeof EXAMPLE; label: string; color: string }> = [
  { key: "netIncome", label: "Net Income", color: "bg-blue-400" },
  { key: "interest", label: "Interest", color: "bg-indigo-400" },
  { key: "taxes", label: "Taxes", color: "bg-purple-400" },
  { key: "depreciation", label: "Depreciation", color: "bg-slate-400" },
  { key: "amortization", label: "Amortization", color: "bg-slate-500" },
];

export default function EbitdaCalculatorPage() {
  const [netIncome, setNetIncome] = useState("");
  const [interest, setInterest] = useState("");
  const [taxes, setTaxes] = useState("");
  const [depreciation, setDepreciation] = useState("");
  const [amortization, setAmortization] = useState("");
  const [revenue, setRevenue] = useState("");

  function loadExample() {
    setNetIncome(EXAMPLE.netIncome);
    setInterest(EXAMPLE.interest);
    setTaxes(EXAMPLE.taxes);
    setDepreciation(EXAMPLE.depreciation);
    setAmortization(EXAMPLE.amortization);
    setRevenue(EXAMPLE.revenue);
  }

  const values = {
    netIncome: toNumber(netIncome),
    interest: toNumber(interest),
    taxes: toNumber(taxes),
    depreciation: toNumber(depreciation),
    amortization: toNumber(amortization),
  };

  const revenueNum = toNumber(revenue);
  const { ebitda, margin } = calculateEbitda({ ...values, revenue: revenueNum });

  const revenueError = revenue.trim() && revenueNum < 0 ? "Revenue can't be negative." : undefined;

  const { icon: Icon, color } = CONCEPT_VISUALS.ebitda;
  const iconColorClass = CONCEPT_COLOR_CLASSES[color].icon;

  return (
    <main className="flex flex-1 flex-col items-center gap-6 p-8 pt-16">
      <div className="flex w-full max-w-2xl items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon className={iconColorClass} size={26} />
          <h1 className="text-3xl font-bold text-foreground">EBITDA Calculator</h1>
        </div>
        <Link
          href="/learning/ebitda"
          className="flex items-center gap-1 text-xs text-foreground/60 hover:text-foreground hover:underline"
        >
          <BookOpen size={12} /> Learn about EBITDA
        </Link>
      </div>

      <ToolCard title="Inputs">
        <div className="mb-4 flex items-center justify-between">
          <span className="text-xs text-foreground/50">Updates live as you type.</span>
          <LoadExampleButton onClick={loadExample} />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <NumberField
            label="Net Income"
            prefix="$"
            value={netIncome}
            onChange={setNetIncome}
            helperText="Bottom-line profit after all expenses, interest, and taxes."
          />
          <NumberField
            label="Interest Expense"
            prefix="$"
            value={interest}
            onChange={setInterest}
            helperText="Interest paid on debt during the period."
          />
          <NumberField
            label="Taxes"
            prefix="$"
            value={taxes}
            onChange={setTaxes}
            helperText="Income taxes paid or accrued during the period."
          />
          <NumberField
            label="Depreciation"
            prefix="$"
            value={depreciation}
            onChange={setDepreciation}
            helperText="Non-cash expense allocating the cost of tangible assets over time."
          />
          <NumberField
            label="Amortization"
            prefix="$"
            value={amortization}
            onChange={setAmortization}
            helperText="Non-cash expense allocating the cost of intangible assets over time."
          />
          <NumberField
            label="Revenue (optional)"
            prefix="$"
            value={revenue}
            onChange={setRevenue}
            error={revenueError}
            helperText="Enter this to also calculate EBITDA margin."
          />
        </div>
      </ToolCard>

      <ToolCard title="Result">
        <dl className="grid grid-cols-2 gap-y-2">
          <dt className="font-semibold text-foreground">EBITDA</dt>
          <dd className="text-right font-semibold text-foreground">
            <AnimatedNumber value={ebitda} format={formatCompactCurrency} />
          </dd>
          {margin !== null && (
            <>
              <dt className="text-foreground/60">EBITDA Margin</dt>
              <dd className="text-right">
                <AnimatedNumber value={margin} format={(v) => formatPercent(v)} />
              </dd>
            </>
          )}
        </dl>

        {ebitda > 0 && (
          <div className="mt-4 flex flex-col gap-1.5">
            <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-foreground/10">
              {COMPOSITION_SEGMENTS.map((segment) => {
                const value = values[segment.key as keyof typeof values] ?? 0;
                if (value <= 0) return null;
                return (
                  <div
                    key={segment.key}
                    className={segment.color}
                    style={{ width: `${(value / ebitda) * 100}%` }}
                    title={`${segment.label}: ${formatCompactCurrency(value)}`}
                  />
                );
              })}
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-foreground/50">
              {COMPOSITION_SEGMENTS.map((segment) => (
                <span key={segment.key} className="flex items-center gap-1">
                  <span className={`h-2 w-2 rounded-full ${segment.color}`} /> {segment.label}
                </span>
              ))}
            </div>
          </div>
        )}

        {ebitda > 0 && (
          <Link
            href={`/tools/ev-ebitda?ebitda=${Math.round(ebitda)}`}
            className="mt-4 inline-block text-xs text-foreground/60 hover:text-foreground hover:underline"
          >
            Use this EBITDA in the EV/EBITDA Calculator →
          </Link>
        )}
      </ToolCard>

      <HowItWorksAccordion>
        <p>
          EBITDA (Earnings Before Interest, Taxes, Depreciation, and Amortization) adds back
          non-operating and non-cash items to net income, aiming to isolate how profitable the
          core business is before financing decisions (interest), tax jurisdiction (taxes), and
          accounting choices (depreciation/amortization) affect the picture.
        </p>
        <p>
          <strong>EBITDA margin</strong> (EBITDA ÷ revenue) makes it easier to compare operating
          efficiency across companies of different sizes.
        </p>
      </HowItWorksAccordion>

      <DisclaimerCallout>
        This is an educational estimation tool, not investment advice. EBITDA excludes real costs
        (interest, taxes, and eventually replacing depreciated assets), so it shouldn&apos;t be
        used as a substitute for net income or free cash flow when judging profitability.
      </DisclaimerCallout>
    </main>
  );
}
