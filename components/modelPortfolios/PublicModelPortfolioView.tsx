"use client";

import { cardClass } from "@/lib/cardStyles";
import SimulatedPerformanceChart from "@/components/portfolio/SimulatedPerformanceChart";
import ModelPortfolioDisclaimer from "@/components/modelPortfolios/ModelPortfolioDisclaimer";
import type { PublicShareView } from "@/lib/modelPortfolios/publicView";

const compactCurrencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 2,
});

// A dedicated component tree, NOT a reuse of ModelPortfolioDetailView —
// deliberately has zero links, zero advisor identity, zero reference to
// any other portfolio. The only external component reused is the chart
// (SimulatedPerformanceChart), which takes fully-resolved data as props and
// has no awareness of auth/ownership at all.
export default function PublicModelPortfolioView({ view }: { view: PublicShareView }) {
  const isUp = view.totalValue - view.notionalBase >= 0;
  // Derived from the performance series' own first point (the portfolio's
  // creation date) rather than adding a separate createdAt field to the
  // public response shape — one less field on the explicit allow-list.
  const createdAt = view.performanceSeries[0]?.date ?? view.asOfDate;

  return (
    <main className="flex flex-1 flex-col items-center gap-6 p-8 pt-16 pb-20">
      <div className="flex w-full max-w-3xl flex-col gap-6">
        <div className="flex flex-col items-center gap-1 text-center">
          <p className="text-sm text-foreground/50">{view.organizationName}</p>
          <h1 className="text-2xl font-bold text-foreground">{view.portfolioName}</h1>
        </div>

        <section className="grid grid-cols-2 gap-4">
          <div className={cardClass("neutral", { extra: "flex flex-col gap-1 p-4" })}>
            <span className="text-xs text-foreground/50">Current Value</span>
            <p className="text-xl font-bold text-foreground">{compactCurrencyFormatter.format(view.totalValue)}</p>
          </div>
          <div className={cardClass("neutral", { extra: "flex flex-col gap-1 p-4" })}>
            <span className="text-xs text-foreground/50">Total Return</span>
            <p className={`text-xl font-bold ${isUp ? "text-green-500" : "text-red-500"}`}>
              {isUp ? "+" : ""}
              {view.totalReturnPercent.toFixed(2)}%
            </p>
          </div>
        </section>

        <SimulatedPerformanceChart
          portfolio={{ createdAt, startingBalance: view.notionalBase }}
          performanceSeries={view.performanceSeries}
          totalValue={view.totalValue}
        />

        <section className={cardClass("neutral", { extra: "flex flex-col gap-3 p-4" })}>
          <h2 className="text-lg font-semibold text-foreground">Target Allocation</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[400px] text-sm">
              <thead>
                <tr className="border-b border-black/10 text-xs text-foreground/50 dark:border-white/15">
                  <th className="p-2 text-left">Symbol</th>
                  <th className="p-2 text-right">Target Weight</th>
                </tr>
              </thead>
              <tbody>
                {view.holdings.map((h) => (
                  <tr key={h.symbol} className="border-t border-black/5 dark:border-white/10">
                    <td className="p-2 font-medium text-foreground">
                      {h.symbol}
                      {h.name && <span className="ml-1 text-xs text-foreground/50">{h.name}</span>}
                    </td>
                    <td className="p-2 text-right text-foreground/70">{h.targetWeightPercent.toFixed(2)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <ModelPortfolioDisclaimer />
        <p className="text-center text-xs text-foreground/40">Shared by {view.organizationName} via Noble</p>
      </div>
    </main>
  );
}
