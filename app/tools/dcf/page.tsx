"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Sparkles, BookOpen } from "lucide-react";
import { CONCEPT_VISUALS, CONCEPT_COLOR_CLASSES } from "@/lib/conceptVisuals";
import ToolCard from "@/components/tools/ToolCard";
import NumberField from "@/components/tools/NumberField";
import AnimatedNumber from "@/components/tools/AnimatedNumber";
import CashFlowBarChart from "@/components/tools/CashFlowBarChart";
import HowItWorksAccordion from "@/components/tools/HowItWorksAccordion";
import LoadExampleButton from "@/components/tools/LoadExampleButton";
import DisclaimerCallout from "@/components/tools/DisclaimerCallout";
import { formatCompactCurrency, formatCurrency, toNumber } from "@/lib/format";
import { calculateDcf } from "@/lib/calculators/dcf";

// A realistic, round-numbered approximation of a well-known large-cap's
// actual scale (not live-fetched — this is the "try it before entering
// your own data" example, not a claim of current precision).
const EXAMPLE = {
  fcf: "100000000000",
  growthRate: "8",
  discountRate: "9",
  years: "5",
  terminalGrowth: "2.5",
  shares: "15500000000",
};

interface FinancialsPeriod {
  freeCashFlow: number | null;
}

function DcfCalculator() {
  const searchParams = useSearchParams();
  const prefillTicker = searchParams.get("ticker");

  const [fcf, setFcf] = useState("1000000");
  const [growthRate, setGrowthRate] = useState("10");
  const [discountRate, setDiscountRate] = useState("9");
  const [years, setYears] = useState("5");
  const [terminalGrowth, setTerminalGrowth] = useState("2.5");
  const [shares, setShares] = useState("");

  const [prefillState, setPrefillState] = useState<"idle" | "loading" | "done" | "unavailable">(
    prefillTicker ? "loading" : "idle"
  );

  // Cross-link from the stock page's Valuation tab ("Estimate intrinsic
  // value with DCF") — pre-fills real reported figures instead of making
  // the user re-enter numbers already available elsewhere in the app.
  // Free cash flow and shares outstanding come straight from already-built
  // endpoints; the growth rate is a simple CAGR across whatever years of
  // FCF history are available (not fetched — there's no "expected future
  // growth" field anywhere in this app's data, so this is the honest
  // stand-in: a historical trend, clearly labeled as a starting point to
  // adjust, not a guaranteed forecast).
  useEffect(() => {
    if (!prefillTicker) return;
    let cancelled = false;

    async function loadPrefill() {
      try {
        const [financialsRes, overviewRes] = await Promise.all([
          fetch(`/api/stock/financials?ticker=${encodeURIComponent(prefillTicker!)}&period=annual`),
          fetch(`/api/stock/overview?ticker=${encodeURIComponent(prefillTicker!)}`),
        ]);
        const financials = financialsRes.ok ? await financialsRes.json().catch(() => null) : null;
        const overview = overviewRes.ok ? await overviewRes.json().catch(() => null) : null;
        if (cancelled) return;

        const periods: FinancialsPeriod[] = Array.isArray(financials?.periods) ? financials.periods : [];
        const latestFcf = periods[0]?.freeCashFlow;
        const oldestFcf = periods[periods.length - 1]?.freeCashFlow;

        let appliedAnything = false;

        if (typeof latestFcf === "number" && latestFcf > 0) {
          setFcf(String(Math.round(latestFcf)));
          appliedAnything = true;
        }
        if (
          periods.length >= 2 &&
          typeof latestFcf === "number" &&
          typeof oldestFcf === "number" &&
          latestFcf > 0 &&
          oldestFcf > 0
        ) {
          const cagr = Math.pow(latestFcf / oldestFcf, 1 / (periods.length - 1)) - 1;
          // Clamped to a sane display range — a volatile FCF history can
          // produce a technically-correct but silly-looking CAGR (e.g.
          // 400%), which would be a worse starting point than just leaving
          // the field at its default.
          if (Number.isFinite(cagr) && cagr > -0.5 && cagr < 1) {
            setGrowthRate((cagr * 100).toFixed(1));
            appliedAnything = true;
          }
        }
        const sharesMillions = overview?.sharesOutstandingMillions;
        if (typeof sharesMillions === "number" && sharesMillions > 0) {
          setShares(String(Math.round(sharesMillions * 1_000_000)));
          appliedAnything = true;
        }

        setPrefillState(appliedAnything ? "done" : "unavailable");
      } catch {
        if (!cancelled) setPrefillState("unavailable");
      }
    }

    loadPrefill();
    return () => {
      cancelled = true;
    };
  }, [prefillTicker]);

  function loadExample() {
    setFcf(EXAMPLE.fcf);
    setGrowthRate(EXAMPLE.growthRate);
    setDiscountRate(EXAMPLE.discountRate);
    setYears(EXAMPLE.years);
    setTerminalGrowth(EXAMPLE.terminalGrowth);
    setShares(EXAMPLE.shares);
    setPrefillState("idle");
  }

  const fcfNum = toNumber(fcf);
  const discountNum = toNumber(discountRate) / 100;
  const yearsRaw = Math.round(toNumber(years));
  const terminalNum = toNumber(terminalGrowth) / 100;
  const sharesNum = toNumber(shares);

  const yearsError =
    years.trim() && (yearsRaw < 1 || yearsRaw > 20) ? "Must be between 1 and 20 years." : undefined;
  const discountError =
    discountRate.trim() && discountNum < 0 ? "Discount rate can't be negative." : undefined;
  const fcfError = fcf.trim() && fcfNum < 0 ? "Free cash flow is usually positive." : undefined;
  const terminalVsDiscountError =
    discountRate.trim() && terminalGrowth.trim() && discountNum <= terminalNum
      ? "Must be lower than the discount rate."
      : undefined;

  const isValid = discountNum > terminalNum;

  const { rows, terminalValue, pvOfTerminalValue, totalIntrinsicValue, fairValuePerShare } = calculateDcf({
    fcf: fcfNum,
    growthRatePercent: toNumber(growthRate),
    discountRatePercent: toNumber(discountRate),
    years: yearsRaw,
    terminalGrowthPercent: toNumber(terminalGrowth),
    shares: sharesNum,
  });

  return (
    <>
      {prefillState === "loading" && (
        <p className="w-full max-w-2xl text-xs text-foreground/50">
          Loading {prefillTicker}&apos;s reported financials…
        </p>
      )}
      {prefillState === "done" && (
        <p className="flex w-full max-w-2xl items-center gap-1.5 text-xs text-indigo-400">
          <Sparkles size={12} /> Pre-filled from {prefillTicker}&apos;s most recent reported financials — adjust
          any assumption below.
        </p>
      )}
      {prefillState === "unavailable" && (
        <p className="w-full max-w-2xl text-xs text-foreground/50">
          Couldn&apos;t load reported financials for {prefillTicker} — enter figures manually below.
        </p>
      )}

      <ToolCard title="Inputs">
        <div className="mb-4 flex items-center justify-between">
          <span className="text-xs text-foreground/50">All figures update the result live.</span>
          <LoadExampleButton onClick={loadExample} />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <NumberField
            label="Current Free Cash Flow"
            prefix="$"
            value={fcf}
            onChange={setFcf}
            error={fcfError}
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
            error={discountError ?? terminalVsDiscountError}
            helperText="Rate used to discount future cash flows to today's value — often a company's weighted average cost of capital."
          />
          <NumberField
            label="Projection Years"
            value={years}
            onChange={setYears}
            error={yearsError}
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
          <div className="h-56 w-full">
            <CashFlowBarChart data={rows} />
          </div>

          <div className="mt-4 overflow-x-auto">
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
            <dd className="text-right">
              <AnimatedNumber value={terminalValue} format={formatCompactCurrency} />
            </dd>
            <dt className="text-foreground/60">PV of Terminal Value</dt>
            <dd className="text-right">
              <AnimatedNumber value={pvOfTerminalValue} format={formatCompactCurrency} />
            </dd>
            <dt className="font-semibold text-foreground">Estimated Intrinsic Value</dt>
            <dd className="text-right font-semibold text-foreground">
              <AnimatedNumber value={totalIntrinsicValue} format={formatCompactCurrency} />
            </dd>
            {fairValuePerShare !== null && (
              <>
                <dt className="font-semibold text-foreground">Fair Value per Share</dt>
                <dd className="text-right font-semibold text-foreground">
                  <AnimatedNumber value={fairValuePerShare} format={formatCurrency} />
                </dd>
              </>
            )}
          </dl>
        </ToolCard>
      )}

      <HowItWorksAccordion>
        <p>
          A DCF (Discounted Cash Flow) estimates what a business is worth today by projecting its
          future free cash flows and discounting them back to present value — money in the future
          is worth less than money today, so each year&apos;s projected cash flow is divided by{" "}
          <code>(1 + discount rate)^year</code>.
        </p>
        <p>
          After the projection period, a <strong>terminal value</strong> captures all cash flows
          beyond it, assuming they grow at a slower, perpetual rate forever:{" "}
          <code>final year FCF × (1 + terminal growth) / (discount rate − terminal growth)</code>.
        </p>
        <p>
          Summing the present value of every projected year plus the discounted terminal value
          gives the total estimated intrinsic value — divide by shares outstanding for a rough
          fair value per share.
        </p>
      </HowItWorksAccordion>

      <DisclaimerCallout>
        This is an educational estimation tool, not investment advice. Small changes in growth or
        discount rate assumptions can swing the result dramatically — treat it as a way to
        understand the mechanics, not a precise valuation.
      </DisclaimerCallout>
    </>
  );
}

const { icon: Icon, color } = CONCEPT_VISUALS.dcf;
const iconColorClass = CONCEPT_COLOR_CLASSES[color].icon;

export default function DcfCalculatorPage() {
  return (
    <main className="flex flex-1 flex-col items-center gap-6 p-8 pt-16">
      <div className="flex w-full max-w-2xl items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon className={iconColorClass} size={26} />
          <h1 className="text-3xl font-bold text-foreground">DCF Calculator</h1>
        </div>
        <Link
          href="/learning/dcf"
          className="flex items-center gap-1 text-xs text-foreground/60 hover:text-foreground hover:underline"
        >
          <BookOpen size={12} /> Learn about DCF
        </Link>
      </div>

      <Suspense fallback={null}>
        <DcfCalculator />
      </Suspense>
    </main>
  );
}
