"use client";

import { useState } from "react";
import { CONCEPT_VISUALS, CONCEPT_COLOR_CLASSES } from "@/lib/conceptVisuals";
import ToolCard from "@/components/tools/ToolCard";
import NumberField from "@/components/tools/NumberField";
import AnimatedNumber from "@/components/tools/AnimatedNumber";
import GrowthProjectionChart, { type GrowthProjectionPoint } from "@/components/tools/GrowthProjectionChart";
import HowItWorksAccordion from "@/components/tools/HowItWorksAccordion";
import LoadExampleButton from "@/components/tools/LoadExampleButton";
import DisclaimerCallout from "@/components/tools/DisclaimerCallout";
import { formatCurrency, toNumber } from "@/lib/format";

const EXAMPLE = {
  initialInvestment: "10000",
  sharePrice: "100",
  dividendYield: "2.5",
  dividendGrowth: "6",
  priceAppreciation: "6",
  years: "20",
};

export default function DripCalculatorPage() {
  const [initialInvestment, setInitialInvestment] = useState("10000");
  const [sharePrice, setSharePrice] = useState("100");
  const [dividendYield, setDividendYield] = useState("2.5");
  const [dividendGrowth, setDividendGrowth] = useState("5");
  const [priceAppreciation, setPriceAppreciation] = useState("6");
  const [years, setYears] = useState("20");

  function loadExample() {
    setInitialInvestment(EXAMPLE.initialInvestment);
    setSharePrice(EXAMPLE.sharePrice);
    setDividendYield(EXAMPLE.dividendYield);
    setDividendGrowth(EXAMPLE.dividendGrowth);
    setPriceAppreciation(EXAMPLE.priceAppreciation);
    setYears(EXAMPLE.years);
  }

  const investmentNum = toNumber(initialInvestment);
  const priceNum = toNumber(sharePrice);
  const yieldNum = toNumber(dividendYield);
  const dividendGrowthNum = toNumber(dividendGrowth);
  const priceAppreciationNum = toNumber(priceAppreciation);
  const yearsRaw = Math.round(toNumber(years));
  const yearsNum = Math.max(1, Math.min(50, yearsRaw || 20));

  const priceError = sharePrice.trim() && priceNum <= 0 ? "Must be a positive price." : undefined;
  const investmentError = initialInvestment.trim() && investmentNum < 0 ? "Can't be negative." : undefined;
  const yearsError = years.trim() && (yearsRaw < 1 || yearsRaw > 50) ? "Must be between 1 and 50 years." : undefined;

  const chartData: GrowthProjectionPoint[] = [];
  let shares = priceNum > 0 ? investmentNum / priceNum : 0;
  let price = priceNum;
  let dividendPerShare = priceNum * (yieldNum / 100);
  let totalDividendsReceived = 0;

  chartData.push({ year: 0, balance: shares * price, contributed: investmentNum });

  for (let year = 1; year <= yearsNum; year++) {
    const dividendsReceived = shares * dividendPerShare;
    totalDividendsReceived += dividendsReceived;
    if (price > 0) shares += dividendsReceived / price;
    price *= 1 + priceAppreciationNum / 100;
    dividendPerShare *= 1 + dividendGrowthNum / 100;
    chartData.push({ year, balance: shares * price, contributed: investmentNum });
  }

  const finalBalance = chartData[chartData.length - 1]?.balance ?? 0;
  const totalGrowth = finalBalance - investmentNum;

  const { icon: Icon, color } = CONCEPT_VISUALS.drip;
  const iconColorClass = CONCEPT_COLOR_CLASSES[color].icon;

  return (
    <main className="flex flex-1 flex-col items-center gap-6 p-8 pt-16">
      <div className="flex items-center gap-2">
        <Icon className={iconColorClass} size={26} />
        <h1 className="text-3xl font-bold text-foreground">DRIP Calculator</h1>
      </div>

      <ToolCard title="Inputs">
        <div className="mb-4 flex items-center justify-between">
          <span className="text-xs text-foreground/50">Updates live as you type.</span>
          <LoadExampleButton onClick={loadExample} />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <NumberField
            label="Initial Investment"
            prefix="$"
            value={initialInvestment}
            onChange={setInitialInvestment}
            error={investmentError}
            helperText="Total dollar amount invested up front."
          />
          <NumberField
            label="Current Share Price"
            prefix="$"
            value={sharePrice}
            onChange={setSharePrice}
            error={priceError}
            helperText="Used to convert your investment into a starting share count."
          />
          <NumberField
            label="Dividend Yield"
            suffix="%"
            value={dividendYield}
            onChange={setDividendYield}
            helperText="Annual dividend as a percentage of share price today."
          />
          <NumberField
            label="Dividend Growth Rate"
            suffix="%"
            value={dividendGrowth}
            onChange={setDividendGrowth}
            helperText="Expected annual growth of the dividend per share."
          />
          <NumberField
            label="Share Price Appreciation"
            suffix="%"
            value={priceAppreciation}
            onChange={setPriceAppreciation}
            helperText="Expected annual growth of the share price itself."
          />
          <NumberField
            label="Years"
            value={years}
            onChange={setYears}
            error={yearsError}
            helperText="How many years to project (1-50)."
          />
        </div>
      </ToolCard>

      <ToolCard title="Result">
        <dl className="grid grid-cols-2 gap-y-2">
          <dt className="text-foreground/60">Total Dividends Reinvested</dt>
          <dd className="text-right">
            <AnimatedNumber value={totalDividendsReceived} format={(v) => formatCurrency(v, 0)} />
          </dd>
          <dt className="text-foreground/60">Total Growth</dt>
          <dd className="text-right text-green-500">
            <AnimatedNumber value={totalGrowth} format={(v) => formatCurrency(v, 0)} />
          </dd>
          <dt className="font-semibold text-foreground">Projected Value</dt>
          <dd className="text-right font-semibold text-foreground">
            <AnimatedNumber value={finalBalance} format={(v) => formatCurrency(v, 0)} />
          </dd>
        </dl>

        <div className="mt-4 h-64 w-full">
          <GrowthProjectionChart data={chartData} />
        </div>
      </ToolCard>

      <HowItWorksAccordion>
        <p>
          A DRIP (Dividend Reinvestment Plan) automatically uses dividend payouts to buy more
          shares instead of paying them out as cash — those new shares then earn their own
          dividends going forward, compounding your share count on top of any price appreciation.
        </p>
        <p>
          This projects year by year: dividends received (shares × dividend per share) are
          reinvested at that year&apos;s price to buy more shares, the dividend per share grows at
          your assumed rate, and the share price appreciates at its own assumed rate — all
          independent inputs, since a stock&apos;s price growth and dividend growth don&apos;t have
          to move together.
        </p>
      </HowItWorksAccordion>

      <DisclaimerCallout>
        This is an educational estimation tool, not investment advice. Real dividend growth and
        price appreciation are never this smooth or guaranteed, and companies can cut dividends
        entirely — this illustrates the mechanics of reinvestment, not a forecast.
      </DisclaimerCallout>
    </main>
  );
}
