"use client";

import NumberField from "@/components/tools/NumberField";
import { formatRatio, toNumber } from "@/lib/format";
import { calculatePeg, interpretPeg } from "@/lib/calculators/peg";

export function toPegInputs(values: Record<string, string>) {
  return { pe: toNumber(values.pe ?? ""), growth: toNumber(values.growth ?? "") };
}

interface PegBlockProps {
  values: Record<string, string>;
  onFieldChange: (key: string, value: string) => void;
}

// Cloned from app/tools/peg/page.tsx's input section.
export default function PegBlock({ values, onFieldChange }: PegBlockProps) {
  const pe = values.pe ?? "";
  const growth = values.growth ?? "";
  const peg = calculatePeg({ pe: toNumber(pe), growth: toNumber(growth) });

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <NumberField label="P/E Ratio" value={pe} onChange={(v) => onFieldChange("pe", v)} />
        <NumberField
          label="Expected EPS Growth Rate"
          suffix="%"
          value={growth}
          onChange={(v) => onFieldChange("growth", v)}
        />
      </div>
      {peg !== null && (
        <p className="text-sm text-foreground/70">
          <span className="font-semibold text-foreground">PEG {formatRatio(peg)}</span> — {interpretPeg(peg)}
        </p>
      )}
    </div>
  );
}
