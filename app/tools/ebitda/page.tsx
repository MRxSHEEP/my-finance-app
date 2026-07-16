"use client";

import { useState } from "react";
import Link from "next/link";
import ToolCard from "@/components/tools/ToolCard";
import NumberField from "@/components/tools/NumberField";
import { formatCompactCurrency, formatPercent, toNumber } from "@/lib/format";

export default function EbitdaCalculatorPage() {
  const [netIncome, setNetIncome] = useState("");
  const [interest, setInterest] = useState("");
  const [taxes, setTaxes] = useState("");
  const [depreciation, setDepreciation] = useState("");
  const [amortization, setAmortization] = useState("");
  const [revenue, setRevenue] = useState("");

  const ebitda =
    toNumber(netIncome) +
    toNumber(interest) +
    toNumber(taxes) +
    toNumber(depreciation) +
    toNumber(amortization);

  const revenueNum = toNumber(revenue);
  const margin = revenueNum > 0 ? (ebitda / revenueNum) * 100 : null;

  return (
    <main className="flex flex-1 flex-col items-center gap-6 p-8 pt-16">
      <h1 className="text-3xl font-bold text-foreground">EBITDA Calculator</h1>

      <ToolCard title="Inputs">
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
            helperText="Enter this to also calculate EBITDA margin."
          />
        </div>
      </ToolCard>

      <ToolCard title="Result">
        <dl className="grid grid-cols-2 gap-y-2">
          <dt className="font-semibold text-foreground">EBITDA</dt>
          <dd className="text-right font-semibold text-foreground">
            {formatCompactCurrency(ebitda)}
          </dd>
          {margin !== null && (
            <>
              <dt className="text-foreground/60">EBITDA Margin</dt>
              <dd className="text-right">{formatPercent(margin)}</dd>
            </>
          )}
        </dl>

        {ebitda > 0 && (
          <Link
            href={`/tools/ev-ebitda?ebitda=${Math.round(ebitda)}`}
            className="mt-3 inline-block text-xs text-foreground/60 hover:text-foreground hover:underline"
          >
            Use this EBITDA in the EV/EBITDA Calculator →
          </Link>
        )}
      </ToolCard>

      <p className="w-full max-w-2xl text-xs text-foreground/60">
        This is an educational estimation tool, not investment advice.
      </p>
    </main>
  );
}
