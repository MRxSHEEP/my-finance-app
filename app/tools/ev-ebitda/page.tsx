"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import ToolCard from "@/components/tools/ToolCard";
import NumberField from "@/components/tools/NumberField";
import { formatCompactCurrency, formatRatio, toNumber } from "@/lib/format";

function EvEbitdaCalculator() {
  const searchParams = useSearchParams();
  const [marketCap, setMarketCap] = useState("");
  const [debt, setDebt] = useState("");
  const [cash, setCash] = useState("");
  // Lazy-initialized from the URL so a link from the EBITDA calculator can
  // pre-fill this field without needing an effect to sync it after mount.
  const [ebitda, setEbitda] = useState(() => searchParams.get("ebitda") ?? "");

  const enterpriseValue = toNumber(marketCap) + toNumber(debt) - toNumber(cash);
  const ebitdaNum = toNumber(ebitda);
  const ratio = ebitdaNum > 0 ? enterpriseValue / ebitdaNum : null;

  return (
    <>
      <ToolCard title="Inputs">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <NumberField
            label="Market Cap"
            prefix="$"
            value={marketCap}
            onChange={setMarketCap}
            helperText="Current share price multiplied by shares outstanding."
          />
          <NumberField
            label="Total Debt"
            prefix="$"
            value={debt}
            onChange={setDebt}
            helperText="Sum of short-term and long-term debt."
          />
          <NumberField
            label="Cash and Equivalents"
            prefix="$"
            value={cash}
            onChange={setCash}
            helperText="Cash, cash equivalents, and short-term investments."
          />
          <NumberField
            label="EBITDA"
            prefix="$"
            value={ebitda}
            onChange={setEbitda}
            helperText="Earnings before interest, taxes, depreciation, and amortization."
          />
        </div>
        <Link
          href="/tools/ebitda"
          className="mt-3 inline-block text-xs text-foreground/60 hover:text-foreground hover:underline"
        >
          Need to calculate EBITDA first? Use the EBITDA Calculator →
        </Link>
      </ToolCard>

      <ToolCard title="Result">
        <dl className="grid grid-cols-2 gap-y-2">
          <dt className="text-foreground/60">Enterprise Value</dt>
          <dd className="text-right">{formatCompactCurrency(enterpriseValue)}</dd>
          <dt className="font-semibold text-foreground">EV/EBITDA</dt>
          <dd className="text-right font-semibold text-foreground">
            {ratio !== null ? formatRatio(ratio) : "—"}
          </dd>
        </dl>
      </ToolCard>
    </>
  );
}

export default function EvEbitdaCalculatorPage() {
  return (
    <main className="flex flex-1 flex-col items-center gap-6 p-8 pt-16">
      <h1 className="text-3xl font-bold text-foreground">EV/EBITDA Calculator</h1>

      <Suspense fallback={null}>
        <EvEbitdaCalculator />
      </Suspense>

      <p className="w-full max-w-2xl text-xs text-foreground/60">
        This is an educational estimation tool, not investment advice.
      </p>
    </main>
  );
}
