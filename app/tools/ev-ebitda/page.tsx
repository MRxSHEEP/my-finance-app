"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { BookOpen } from "lucide-react";
import { CONCEPT_VISUALS, CONCEPT_COLOR_CLASSES } from "@/lib/conceptVisuals";
import ToolCard from "@/components/tools/ToolCard";
import NumberField from "@/components/tools/NumberField";
import AnimatedNumber from "@/components/tools/AnimatedNumber";
import HowItWorksAccordion from "@/components/tools/HowItWorksAccordion";
import LoadExampleButton from "@/components/tools/LoadExampleButton";
import DisclaimerCallout from "@/components/tools/DisclaimerCallout";
import { formatCompactCurrency, formatRatio, toNumber } from "@/lib/format";
import { calculateEvEbitda } from "@/lib/calculators/evEbitda";

const EXAMPLE = {
  marketCap: "2500000000000",
  debt: "120000000000",
  cash: "60000000000",
  ebitda: "130000000000",
};

function EvEbitdaCalculator() {
  const searchParams = useSearchParams();
  const [marketCap, setMarketCap] = useState("");
  const [debt, setDebt] = useState("");
  const [cash, setCash] = useState("");
  // Lazy-initialized from the URL so a link from the EBITDA calculator can
  // pre-fill this field without needing an effect to sync it after mount.
  const [ebitda, setEbitda] = useState(() => searchParams.get("ebitda") ?? "");

  function loadExample() {
    setMarketCap(EXAMPLE.marketCap);
    setDebt(EXAMPLE.debt);
    setCash(EXAMPLE.cash);
    setEbitda(EXAMPLE.ebitda);
  }

  const marketCapNum = toNumber(marketCap);
  const debtNum = toNumber(debt);
  const cashNum = toNumber(cash);
  const ebitdaNum = toNumber(ebitda);
  const {
    enterpriseValue,
    ratio,
    netDebt,
    marketCapSharePercent: marketCapShare,
    netDebtSharePercent: netDebtShare,
  } = calculateEvEbitda({ marketCap: marketCapNum, debt: debtNum, cash: cashNum, ebitda: ebitdaNum });

  const marketCapError = marketCap.trim() && marketCapNum < 0 ? "Market cap can't be negative." : undefined;

  return (
    <>
      <ToolCard title="Inputs">
        <div className="mb-4 flex items-center justify-between">
          <span className="text-xs text-foreground/50">Updates live as you type.</span>
          <LoadExampleButton onClick={loadExample} />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <NumberField
            label="Market Cap"
            prefix="$"
            value={marketCap}
            onChange={setMarketCap}
            error={marketCapError}
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
          <dd className="text-right">
            <AnimatedNumber value={enterpriseValue} format={formatCompactCurrency} />
          </dd>
          <dt className="font-semibold text-foreground">EV/EBITDA</dt>
          <dd className="text-right font-semibold text-foreground">
            {ratio !== null ? <AnimatedNumber value={ratio} format={(v) => formatRatio(v)} /> : "—"}
          </dd>
        </dl>

        {enterpriseValue > 0 && (
          <div className="mt-4 flex flex-col gap-1.5">
            <p className="text-xs font-medium text-foreground/70">What makes up Enterprise Value</p>
            <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-foreground/10">
              {marketCapShare > 0 && (
                <div
                  className="bg-blue-400"
                  style={{ width: `${marketCapShare}%` }}
                  title={`Market Cap: ${formatCompactCurrency(marketCapNum)}`}
                />
              )}
              {netDebtShare > 0 && (
                <div
                  className="bg-indigo-400"
                  style={{ width: `${netDebtShare}%` }}
                  title={`Net Debt: ${formatCompactCurrency(netDebt)}`}
                />
              )}
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-foreground/50">
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-blue-400" /> Market Cap (
                {formatCompactCurrency(marketCapNum)})
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-indigo-400" /> Net Debt (
                {formatCompactCurrency(netDebt)})
              </span>
            </div>
          </div>
        )}
      </ToolCard>

      <HowItWorksAccordion>
        <p>
          <strong>Enterprise Value</strong> is the theoretical takeover price of a business — what
          you&apos;d pay for the equity (market cap) plus the debt you&apos;d assume, minus the cash
          sitting on the balance sheet that you&apos;d immediately have access to.
        </p>
        <p>
          Dividing by EBITDA gives a valuation multiple that&apos;s capital-structure neutral —
          unlike a plain P/E ratio, EV/EBITDA doesn&apos;t change just because a company takes on
          more debt or holds more cash, which makes it a common way to compare companies with
          different leverage.
        </p>
      </HowItWorksAccordion>

      <DisclaimerCallout>
        This is an educational estimation tool, not investment advice. A &quot;good&quot; EV/EBITDA multiple
        varies a lot by industry and growth stage — always compare against similar companies, not
        a single fixed threshold.
      </DisclaimerCallout>
    </>
  );
}

const { icon: Icon, color } = CONCEPT_VISUALS["ev-ebitda"];
const iconColorClass = CONCEPT_COLOR_CLASSES[color].icon;

export default function EvEbitdaCalculatorPage() {
  return (
    <main className="flex flex-1 flex-col items-center gap-6 p-8 pt-16">
      <div className="flex w-full max-w-2xl items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon className={iconColorClass} size={26} />
          <h1 className="text-3xl font-bold text-foreground">EV/EBITDA Calculator</h1>
        </div>
        <Link
          href="/learning/ev-ebitda"
          className="flex items-center gap-1 text-xs text-foreground/60 hover:text-foreground hover:underline"
        >
          <BookOpen size={12} /> Learn about EV/EBITDA
        </Link>
      </div>

      <Suspense fallback={null}>
        <EvEbitdaCalculator />
      </Suspense>
    </main>
  );
}
