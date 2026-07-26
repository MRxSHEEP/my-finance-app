"use client";

import NumberField from "@/components/tools/NumberField";
import { formatCompactCurrency, formatRatio, toNumber } from "@/lib/format";
import { calculateEvEbitda } from "@/lib/calculators/evEbitda";

export function toEvEbitdaInputs(values: Record<string, string>) {
  return {
    marketCap: toNumber(values.marketCap ?? ""),
    debt: toNumber(values.debt ?? ""),
    cash: toNumber(values.cash ?? ""),
    ebitda: toNumber(values.ebitda ?? ""),
  };
}

interface EvEbitdaBlockProps {
  values: Record<string, string>;
  onFieldChange: (key: string, value: string) => void;
}

// Cloned from app/tools/ev-ebitda/page.tsx's input section.
export default function EvEbitdaBlock({ values, onFieldChange }: EvEbitdaBlockProps) {
  const marketCap = values.marketCap ?? "";
  const debt = values.debt ?? "";
  const cash = values.cash ?? "";
  const ebitda = values.ebitda ?? "";

  const result = calculateEvEbitda({
    marketCap: toNumber(marketCap),
    debt: toNumber(debt),
    cash: toNumber(cash),
    ebitda: toNumber(ebitda),
  });

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <NumberField label="Market Cap" prefix="$" value={marketCap} onChange={(v) => onFieldChange("marketCap", v)} />
        <NumberField label="Total Debt" prefix="$" value={debt} onChange={(v) => onFieldChange("debt", v)} />
        <NumberField
          label="Cash and Equivalents"
          prefix="$"
          value={cash}
          onChange={(v) => onFieldChange("cash", v)}
        />
        <NumberField label="EBITDA" prefix="$" value={ebitda} onChange={(v) => onFieldChange("ebitda", v)} />
      </div>

      <dl className="grid grid-cols-2 gap-y-1 text-sm">
        <dt className="text-foreground/60">Enterprise Value</dt>
        <dd className="text-right">{formatCompactCurrency(result.enterpriseValue)}</dd>
        <dt className="font-semibold text-foreground">EV/EBITDA</dt>
        <dd className="text-right font-semibold text-foreground">
          {result.ratio !== null ? formatRatio(result.ratio) : "—"}
        </dd>
      </dl>
    </div>
  );
}
