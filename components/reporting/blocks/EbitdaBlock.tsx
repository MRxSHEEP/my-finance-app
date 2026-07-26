"use client";

import NumberField from "@/components/tools/NumberField";
import { formatCompactCurrency, formatPercent, toNumber } from "@/lib/format";
import { calculateEbitda } from "@/lib/calculators/ebitda";

export function toEbitdaInputs(values: Record<string, string>) {
  return {
    netIncome: toNumber(values.netIncome ?? ""),
    interest: toNumber(values.interest ?? ""),
    taxes: toNumber(values.taxes ?? ""),
    depreciation: toNumber(values.depreciation ?? ""),
    amortization: toNumber(values.amortization ?? ""),
    revenue: toNumber(values.revenue ?? ""),
  };
}

interface EbitdaBlockProps {
  values: Record<string, string>;
  onFieldChange: (key: string, value: string) => void;
}

// Cloned from app/tools/ebitda/page.tsx's input section.
export default function EbitdaBlock({ values, onFieldChange }: EbitdaBlockProps) {
  const netIncome = values.netIncome ?? "";
  const interest = values.interest ?? "";
  const taxes = values.taxes ?? "";
  const depreciation = values.depreciation ?? "";
  const amortization = values.amortization ?? "";
  const revenue = values.revenue ?? "";

  const result = calculateEbitda({
    netIncome: toNumber(netIncome),
    interest: toNumber(interest),
    taxes: toNumber(taxes),
    depreciation: toNumber(depreciation),
    amortization: toNumber(amortization),
    revenue: toNumber(revenue),
  });

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <NumberField label="Net Income" prefix="$" value={netIncome} onChange={(v) => onFieldChange("netIncome", v)} />
        <NumberField
          label="Interest Expense"
          prefix="$"
          value={interest}
          onChange={(v) => onFieldChange("interest", v)}
        />
        <NumberField label="Taxes" prefix="$" value={taxes} onChange={(v) => onFieldChange("taxes", v)} />
        <NumberField
          label="Depreciation"
          prefix="$"
          value={depreciation}
          onChange={(v) => onFieldChange("depreciation", v)}
        />
        <NumberField
          label="Amortization"
          prefix="$"
          value={amortization}
          onChange={(v) => onFieldChange("amortization", v)}
        />
        <NumberField
          label="Revenue (optional)"
          prefix="$"
          value={revenue}
          onChange={(v) => onFieldChange("revenue", v)}
        />
      </div>

      <dl className="grid grid-cols-2 gap-y-1 text-sm">
        <dt className="font-semibold text-foreground">EBITDA</dt>
        <dd className="text-right font-semibold text-foreground">{formatCompactCurrency(result.ebitda)}</dd>
        {result.margin !== null && (
          <>
            <dt className="text-foreground/60">EBITDA Margin</dt>
            <dd className="text-right">{formatPercent(result.margin)}</dd>
          </>
        )}
      </dl>
    </div>
  );
}
