"use client";

import NumberField from "@/components/tools/NumberField";
import { formatCompactCurrency, formatCurrency, toNumber } from "@/lib/format";
import { calculateDcf } from "@/lib/calculators/dcf";

export const DCF_DEFAULTS: Record<string, string> = {
  fcf: "1000000",
  growthRate: "10",
  discountRate: "9",
  years: "5",
  terminalGrowth: "2.5",
  shares: "",
};

export function toDcfInputs(values: Record<string, string>) {
  return {
    fcf: toNumber(values.fcf ?? DCF_DEFAULTS.fcf),
    growthRatePercent: toNumber(values.growthRate ?? DCF_DEFAULTS.growthRate),
    discountRatePercent: toNumber(values.discountRate ?? DCF_DEFAULTS.discountRate),
    years: toNumber(values.years ?? DCF_DEFAULTS.years),
    terminalGrowthPercent: toNumber(values.terminalGrowth ?? DCF_DEFAULTS.terminalGrowth),
    shares: toNumber(values.shares ?? DCF_DEFAULTS.shares),
  };
}

interface DcfBlockProps {
  values: Record<string, string>;
  onFieldChange: (key: string, value: string) => void;
}

// Cloned from app/tools/dcf/page.tsx's input section; the math itself is
// shared via lib/calculators/dcf.ts rather than duplicated.
export default function DcfBlock({ values, onFieldChange }: DcfBlockProps) {
  const fcf = values.fcf ?? DCF_DEFAULTS.fcf;
  const growthRate = values.growthRate ?? DCF_DEFAULTS.growthRate;
  const discountRate = values.discountRate ?? DCF_DEFAULTS.discountRate;
  const years = values.years ?? DCF_DEFAULTS.years;
  const terminalGrowth = values.terminalGrowth ?? DCF_DEFAULTS.terminalGrowth;
  const shares = values.shares ?? DCF_DEFAULTS.shares;

  const result = calculateDcf({
    fcf: toNumber(fcf),
    growthRatePercent: toNumber(growthRate),
    discountRatePercent: toNumber(discountRate),
    years: toNumber(years),
    terminalGrowthPercent: toNumber(terminalGrowth),
    shares: toNumber(shares),
  });

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <NumberField label="Current Free Cash Flow" prefix="$" value={fcf} onChange={(v) => onFieldChange("fcf", v)} />
        <NumberField
          label="Expected Growth Rate"
          suffix="%"
          value={growthRate}
          onChange={(v) => onFieldChange("growthRate", v)}
        />
        <NumberField
          label="Discount Rate (WACC)"
          suffix="%"
          value={discountRate}
          onChange={(v) => onFieldChange("discountRate", v)}
        />
        <NumberField label="Projection Years" value={years} onChange={(v) => onFieldChange("years", v)} />
        <NumberField
          label="Terminal Growth Rate"
          suffix="%"
          value={terminalGrowth}
          onChange={(v) => onFieldChange("terminalGrowth", v)}
        />
        <NumberField
          label="Shares Outstanding (optional)"
          value={shares}
          onChange={(v) => onFieldChange("shares", v)}
        />
      </div>

      {result.isValid ? (
        <dl className="grid grid-cols-2 gap-y-1 text-sm">
          <dt className="text-foreground/60">Estimated Intrinsic Value</dt>
          <dd className="text-right font-semibold text-foreground">
            {formatCompactCurrency(result.totalIntrinsicValue)}
          </dd>
          {result.fairValuePerShare !== null && (
            <>
              <dt className="text-foreground/60">Fair Value per Share</dt>
              <dd className="text-right font-semibold text-foreground">{formatCurrency(result.fairValuePerShare)}</dd>
            </>
          )}
        </dl>
      ) : (
        <p className="text-xs text-red-500">Discount rate must exceed terminal growth rate.</p>
      )}
    </div>
  );
}
