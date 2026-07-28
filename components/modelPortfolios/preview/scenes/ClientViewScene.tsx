import { cardClass } from "@/lib/cardStyles";
import SimulatedPerformanceChart from "@/components/portfolio/SimulatedPerformanceChart";
import ModelPortfolioDisclaimer from "@/components/modelPortfolios/ModelPortfolioDisclaimer";
import {
  DEMO_CREATED_AT,
  DEMO_HOLDINGS,
  DEMO_ORG_NAME,
  DEMO_PERFORMANCE_SERIES,
  DEMO_PORTFOLIO_NAME,
  DEMO_TOTAL_RETURN_PERCENT,
  DEMO_TOTAL_VALUE,
} from "@/components/modelPortfolios/preview/sampleData";

const compactCurrencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 2,
});

// Mirrors PublicModelPortfolioView.tsx's markup/classes exactly — this is
// the one real page in the whole product with zero sign-in, zero advisor
// identity, zero links elsewhere (see that component's own comment), so
// recreating it here is the most faithful possible preview of what a
// client actually opens. ModelPortfolioDisclaimer is the real, unmodified
// component (pure/static, no props, no fetch) — nothing to recreate there.
export default function ClientViewScene() {
  const isUp = DEMO_TOTAL_RETURN_PERCENT >= 0;

  return (
    <div className="flex flex-col gap-4 text-left">
      <div className="flex flex-col items-center gap-1 text-center">
        <p className="text-sm text-foreground/50">{DEMO_ORG_NAME}</p>
        <h1 className="text-xl font-bold text-foreground">{DEMO_PORTFOLIO_NAME}</h1>
      </div>

      <section className="grid grid-cols-2 gap-3">
        <div className={cardClass("neutral", { extra: "flex flex-col gap-1 p-3" })}>
          <span className="text-xs text-foreground/50">Current Value</span>
          <p className="text-lg font-bold text-foreground">{compactCurrencyFormatter.format(DEMO_TOTAL_VALUE)}</p>
        </div>
        <div className={cardClass("neutral", { extra: "flex flex-col gap-1 p-3" })}>
          <span className="text-xs text-foreground/50">Total Return</span>
          <p className={`text-lg font-bold ${isUp ? "text-green-500" : "text-red-500"}`}>
            {isUp ? "+" : ""}
            {DEMO_TOTAL_RETURN_PERCENT.toFixed(2)}%
          </p>
        </div>
      </section>

      <SimulatedPerformanceChart
        portfolio={{ createdAt: DEMO_CREATED_AT, startingBalance: 10000 }}
        performanceSeries={DEMO_PERFORMANCE_SERIES}
        totalValue={DEMO_TOTAL_VALUE}
      />

      <section className={cardClass("neutral", { extra: "flex flex-col gap-2 p-3" })}>
        <h2 className="text-sm font-semibold text-foreground">Target Allocation</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[400px] text-sm">
            <thead>
              <tr className="border-b border-black/10 text-xs text-foreground/50 dark:border-white/15">
                <th className="p-2 text-left">Symbol</th>
                <th className="p-2 text-right">Target Weight</th>
              </tr>
            </thead>
            <tbody>
              {DEMO_HOLDINGS.map((h) => (
                <tr key={h.symbol} className="border-t border-black/5 dark:border-white/10">
                  <td className="p-2 font-medium text-foreground">
                    {h.symbol}
                    <span className="ml-1 text-xs text-foreground/50">{h.name}</span>
                  </td>
                  <td className="p-2 text-right text-foreground/70">{h.targetWeightPercent.toFixed(2)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <ModelPortfolioDisclaimer />
      <p className="text-center text-xs text-foreground/40">Shared by {DEMO_ORG_NAME} via Noble</p>
    </div>
  );
}
