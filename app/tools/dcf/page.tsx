"use client";

import { useState } from "react";
import ToolCard from "@/components/tools/ToolCard";
import NumberField from "@/components/tools/NumberField";
import { formatCompactCurrency, formatCurrency, toNumber } from "@/lib/format";

export default function DcfCalculatorPage() {
  const [fcf, setFcf] = useState("1000000");
  const [growthRate, setGrowthRate] = useState("10");
  const [discountRate, setDiscountRate] = useState("9");
  const [years, setYears] = useState("5");
  const [terminalGrowth, setTerminalGrowth] = useState("2.5");
  const [shares, setShares] = useState("");

  const fcfNum = toNumber(fcf);
  const growthNum = toNumber(growthRate) / 100;
  const discountNum = toNumber(discountRate) / 100;
  const yearsNum = Math.max(1, Math.min(20, Math.round(toNumber(years)) || 5));
  const terminalNum = toNumber(terminalGrowth) / 100;
  const sharesNum = toNumber(shares);

  const isValid = discountNum > terminalNum;

  const rows: { year: number; projectedFcf: number; presentValue: number }[] = [];
  let cumulativePV = 0;

  for (let year = 1; year <= yearsNum; year++) {
    const projectedFcf = fcfNum * Math.pow(1 + growthNum, year);
    const presentValue = projectedFcf / Math.pow(1 + discountNum, year);
    rows.push({ year, projectedFcf, presentValue });
    cumulativePV += presentValue;
  }

  const finalYearFcf = rows[rows.length - 1]?.projectedFcf ?? 0;
  const terminalValue = isValid
    ? (finalYearFcf * (1 + terminalNum)) / (discountNum - terminalNum)
    : 0;
  const pvOfTerminalValue = isValid
    ? terminalValue / Math.pow(1 + discountNum, yearsNum)
    : 0;

  const totalIntrinsicValue = cumulativePV + pvOfTerminalValue;
  const fairValuePerShare = sharesNum > 0 ? totalIntrinsicValue / sharesNum : null;

  return (
    <main className="flex flex-1 flex-col items-center gap-6 p-8 pt-16">
      <h1 className="text-3xl font-bold text-foreground">DCF Calculator</h1>

      <ToolCard title="Inputs">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <NumberField
            label="Current Free Cash Flow"
            prefix="$"
            value={fcf}
            onChange={setFcf}
            helperText="The company's most recent annual free cash flow (operating cash flow minus capital expenditures)."
          />
          <NumberField
            label="Expected Growth Rate"
            suffix="%"
            value={growthRate}
            onChange={setGrowthRate}
            helperText="Annual rate you expect free cash flow to grow during the projection period."
          />
          <NumberField
            label="Discount Rate (WACC)"
            suffix="%"
            value={discountRate}
            onChange={setDiscountRate}
            helperText="Rate used to discount future cash flows to today's value — often a company's weighted average cost of capital."
          />
          <NumberField
            label="Projection Years"
            value={years}
            onChange={setYears}
            helperText="How many years to project cash flows before applying a terminal value (1-20)."
          />
          <NumberField
            label="Terminal Growth Rate"
            suffix="%"
            value={terminalGrowth}
            onChange={setTerminalGrowth}
            helperText="Perpetual growth rate assumed after the projection period — usually close to long-run GDP growth."
          />
          <NumberField
            label="Shares Outstanding (optional)"
            value={shares}
            onChange={setShares}
            helperText="Enter this to convert total intrinsic value into an estimated fair value per share."
          />
        </div>
      </ToolCard>

      {!isValid && (
        <p className="w-full max-w-2xl text-sm text-red-500">
          Discount rate must be greater than the terminal growth rate for the terminal value to
          be meaningful.
        </p>
      )}

      {isValid && (
        <ToolCard title="Projected Cash Flows">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-black/10 text-foreground/60 dark:border-white/15">
                  <th className="py-2 pr-4 font-medium">Year</th>
                  <th className="py-2 pr-4 font-medium">Projected FCF</th>
                  <th className="py-2 font-medium">Present Value</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.year} className="border-b border-black/5 dark:border-white/10">
                    <td className="py-2 pr-4">{row.year}</td>
                    <td className="py-2 pr-4">{formatCompactCurrency(row.projectedFcf)}</td>
                    <td className="py-2">{formatCompactCurrency(row.presentValue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <dl className="mt-4 grid grid-cols-2 gap-y-2">
            <dt className="text-foreground/60">Terminal Value</dt>
            <dd className="text-right">{formatCompactCurrency(terminalValue)}</dd>
            <dt className="text-foreground/60">PV of Terminal Value</dt>
            <dd className="text-right">{formatCompactCurrency(pvOfTerminalValue)}</dd>
            <dt className="font-semibold text-foreground">Estimated Intrinsic Value</dt>
            <dd className="text-right font-semibold text-foreground">
              {formatCompactCurrency(totalIntrinsicValue)}
            </dd>
            {fairValuePerShare !== null && (
              <>
                <dt className="font-semibold text-foreground">Fair Value per Share</dt>
                <dd className="text-right font-semibold text-foreground">
                  {formatCurrency(fairValuePerShare)}
                </dd>
              </>
            )}
          </dl>
        </ToolCard>
      )}

      <p className="w-full max-w-2xl text-xs text-foreground/60">
        This is an educational estimation tool, not investment advice.
      </p>
    </main>
  );
}
