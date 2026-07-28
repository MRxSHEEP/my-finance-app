import { Calculator } from "lucide-react";
import { cardClass } from "@/lib/cardStyles";
import { DEMO_DCF_INPUTS, DEMO_DCF_RESULT } from "@/components/reporting/preview/sampleData";

const FIELDS: Array<{ label: string; value: string; prefix?: string; suffix?: string }> = [
  { label: "Current Free Cash Flow", value: DEMO_DCF_INPUTS.fcf, prefix: "$" },
  { label: "Expected Growth Rate", value: DEMO_DCF_INPUTS.growthRate, suffix: "%" },
  { label: "Discount Rate (WACC)", value: DEMO_DCF_INPUTS.discountRate, suffix: "%" },
  { label: "Projection Years", value: DEMO_DCF_INPUTS.years },
  { label: "Terminal Growth Rate", value: DEMO_DCF_INPUTS.terminalGrowth, suffix: "%" },
  { label: "Shares Outstanding", value: DEMO_DCF_INPUTS.shares },
];

// Mirrors DcfBlock.tsx's field grid + result markup/classes — static
// values instead of live NumberField state. DEMO_DCF_RESULT is the real
// calculateDcf() output for these exact inputs (see sampleData.ts's own
// comment), not an invented figure.
export default function CalculatorScene() {
  return (
    <div className={cardClass("neutral", { extra: "flex flex-col gap-3 p-4 text-left" })}>
      <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
        <Calculator size={15} className="text-foreground/40" />
        DCF Valuation
      </h3>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {FIELDS.map((f) => (
          <label key={f.label} className="flex flex-col gap-1">
            <span className="text-sm font-medium text-foreground">{f.label}</span>
            <div className="flex items-center gap-1 rounded-md border border-black/10 px-3 py-2 text-sm dark:border-white/15">
              {f.prefix && <span className="text-foreground/50">{f.prefix}</span>}
              <span className="text-foreground">{f.value}</span>
              {f.suffix && <span className="text-foreground/50">{f.suffix}</span>}
            </div>
          </label>
        ))}
      </div>

      <dl className="grid grid-cols-2 gap-y-1 text-sm">
        <dt className="text-foreground/60">Estimated Intrinsic Value</dt>
        <dd className="text-right font-semibold text-foreground">{DEMO_DCF_RESULT.intrinsicValue}</dd>
        <dt className="text-foreground/60">Fair Value per Share</dt>
        <dd className="text-right font-semibold text-foreground">{DEMO_DCF_RESULT.fairValuePerShare}</dd>
      </dl>
    </div>
  );
}
