"use client";

import { useState } from "react";
import { CONCEPT_VISUALS, CONCEPT_COLOR_CLASSES } from "@/lib/conceptVisuals";
import ToolCard from "@/components/tools/ToolCard";
import NumberField from "@/components/tools/NumberField";
import AnimatedNumber from "@/components/tools/AnimatedNumber";
import HowItWorksAccordion from "@/components/tools/HowItWorksAccordion";
import LoadExampleButton from "@/components/tools/LoadExampleButton";
import DisclaimerCallout from "@/components/tools/DisclaimerCallout";
import { formatCurrency, formatPercent, formatRatio, toNumber } from "@/lib/format";

const EXAMPLE = {
  accountSize: "50000",
  riskPercent: "1",
  entryPrice: "82.50",
  stopLoss: "78.00",
  takeProfit: "95.00",
};

export default function PositionSizeCalculatorPage() {
  const [accountSize, setAccountSize] = useState("");
  const [riskPercent, setRiskPercent] = useState("1");
  const [entryPrice, setEntryPrice] = useState("");
  const [stopLoss, setStopLoss] = useState("");
  const [takeProfit, setTakeProfit] = useState("");

  function loadExample() {
    setAccountSize(EXAMPLE.accountSize);
    setRiskPercent(EXAMPLE.riskPercent);
    setEntryPrice(EXAMPLE.entryPrice);
    setStopLoss(EXAMPLE.stopLoss);
    setTakeProfit(EXAMPLE.takeProfit);
  }

  const accountSizeNum = toNumber(accountSize);
  const riskPercentNum = toNumber(riskPercent);
  const entryNum = toNumber(entryPrice);
  const stopNum = toNumber(stopLoss);
  const takeProfitNum = toNumber(takeProfit);

  const accountError = accountSize.trim() && accountSizeNum <= 0 ? "Must be a positive amount." : undefined;
  const entryError = entryPrice.trim() && entryNum <= 0 ? "Must be a positive price." : undefined;
  const stopError =
    stopLoss.trim() && entryPrice.trim() && stopNum === entryNum
      ? "Stop-loss must differ from entry price."
      : undefined;
  const riskWarning = riskPercentNum > 5 ? "Risking more than 5% of an account on one trade is aggressive." : undefined;

  const riskPerShare = Math.abs(entryNum - stopNum);
  const riskAmount = accountSizeNum * (riskPercentNum / 100);
  const rawShares = riskPerShare > 0 ? riskAmount / riskPerShare : null;
  const shares = rawShares !== null ? Math.floor(rawShares) : null;
  const positionValue = shares !== null ? shares * entryNum : null;
  const positionPercentOfAccount =
    positionValue !== null && accountSizeNum > 0 ? (positionValue / accountSizeNum) * 100 : null;
  const actualRiskAmount = shares !== null ? shares * riskPerShare : null;

  const isLong = stopNum < entryNum;
  const rewardPerShare = takeProfitNum > 0 ? Math.abs(takeProfitNum - entryNum) : null;
  const riskRewardRatio =
    rewardPerShare !== null && riskPerShare > 0 ? rewardPerShare / riskPerShare : null;

  const accountAtRiskShare =
    riskPercentNum > 0 ? Math.max(0, Math.min(100, riskPercentNum)) : 0;

  const { icon: Icon, color } = CONCEPT_VISUALS["position-size"];
  const iconColorClass = CONCEPT_COLOR_CLASSES[color].icon;

  return (
    <main className="flex flex-1 flex-col items-center gap-6 p-8 pt-16">
      <div className="flex items-center gap-2">
        <Icon className={iconColorClass} size={26} />
        <h1 className="text-3xl font-bold text-foreground">Position Size Calculator</h1>
      </div>

      <ToolCard title="Inputs">
        <div className="mb-4 flex items-center justify-between">
          <span className="text-xs text-foreground/50">Updates live as you type.</span>
          <LoadExampleButton onClick={loadExample} />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <NumberField
            label="Account Size"
            prefix="$"
            value={accountSize}
            onChange={setAccountSize}
            error={accountError}
            helperText="Total capital in your trading account."
          />
          <NumberField
            label="Risk Per Trade"
            suffix="%"
            value={riskPercent}
            onChange={setRiskPercent}
            error={riskWarning}
            helperText="How much of your account you're willing to lose on this trade."
          />
          <NumberField
            label="Entry Price"
            prefix="$"
            value={entryPrice}
            onChange={setEntryPrice}
            error={entryError}
            helperText="The price you plan to enter at."
          />
          <NumberField
            label="Stop-Loss Price"
            prefix="$"
            value={stopLoss}
            onChange={setStopLoss}
            error={stopError}
            helperText="The price at which you'd exit to cap your loss."
          />
          <NumberField
            label="Take-Profit Price (optional)"
            prefix="$"
            value={takeProfit}
            onChange={setTakeProfit}
            helperText="Enter this to also see your risk:reward ratio."
          />
        </div>
      </ToolCard>

      {shares !== null && (
        <ToolCard title="Result">
          <dl className="grid grid-cols-2 gap-y-2">
            <dt className="font-semibold text-foreground">Position Size</dt>
            <dd className="text-right font-semibold text-foreground">
              <AnimatedNumber value={shares} format={(v) => `${Math.round(v).toLocaleString()} shares`} />
            </dd>
            <dt className="text-foreground/60">Position Value</dt>
            <dd className="text-right">
              {positionValue !== null ? (
                <AnimatedNumber value={positionValue} format={(v) => formatCurrency(v, 0)} />
              ) : (
                "—"
              )}
            </dd>
            <dt className="text-foreground/60">% of Account Deployed</dt>
            <dd className="text-right">
              {positionPercentOfAccount !== null ? (
                <AnimatedNumber value={positionPercentOfAccount} format={(v) => formatPercent(v)} />
              ) : (
                "—"
              )}
            </dd>
            <dt className="text-foreground/60">Actual Amount at Risk</dt>
            <dd className="text-right text-red-500">
              {actualRiskAmount !== null ? (
                <AnimatedNumber value={actualRiskAmount} format={(v) => formatCurrency(v, 0)} />
              ) : (
                "—"
              )}
            </dd>
            {riskRewardRatio !== null && (
              <>
                <dt className="font-semibold text-foreground">Risk:Reward Ratio</dt>
                <dd className="text-right font-semibold text-green-500">
                  1 : <AnimatedNumber value={riskRewardRatio} format={(v) => formatRatio(v)} />
                </dd>
              </>
            )}
          </dl>

          <div className="mt-4 flex flex-col gap-1.5">
            <p className="text-xs font-medium text-foreground/70">
              Risk as a share of account ({isLong ? "long" : "short"} position)
            </p>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-foreground/10">
              <div
                className="h-full bg-gradient-to-r from-amber-500 to-red-500"
                style={{ width: `${accountAtRiskShare}%` }}
              />
            </div>
          </div>
        </ToolCard>
      )}

      <HowItWorksAccordion>
        <p>
          Position sizing answers a simple but critical question: given how much you&apos;re
          willing to lose, how many shares can you actually buy? First, the dollar amount at risk
          is <code>account size × risk %</code>. Then, dividing that by the per-share risk (the
          distance between your entry and stop-loss) gives the maximum position size that keeps
          your loss at or below that dollar amount if the stop is hit.
        </p>
        <p>
          A common professional guideline is risking no more than 1-2% of an account on any single
          trade — that way, even a losing streak doesn&apos;t do lasting damage, and the account
          can recover from any one bad trade.
        </p>
      </HowItWorksAccordion>

      <DisclaimerCallout>
        This is an educational estimation tool, not investment or trading advice. It assumes you
        exit exactly at your stop-loss price, which isn&apos;t guaranteed in fast-moving or illiquid
        markets (slippage/gaps can result in a larger loss than calculated here).
      </DisclaimerCallout>
    </main>
  );
}
