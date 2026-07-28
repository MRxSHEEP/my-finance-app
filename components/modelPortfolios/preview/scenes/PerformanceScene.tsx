import { cardClass } from "@/lib/cardStyles";
import SimulatedPerformanceChart from "@/components/portfolio/SimulatedPerformanceChart";
import {
  DEMO_CREATED_AT,
  DEMO_HOLDINGS,
  DEMO_PERFORMANCE_SERIES,
  DEMO_TOTAL_RETURN,
  DEMO_TOTAL_RETURN_PERCENT,
  DEMO_TOTAL_VALUE,
} from "@/components/modelPortfolios/preview/sampleData";

const currencyFormatter = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const compactCurrencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 2,
});

// Mirrors ModelPortfolioDetailView.tsx's stat cards + holdings table
// markup/classes exactly, fed fictional data — but SimulatedPerformanceChart
// itself is the REAL, unmodified component, not a recreation: it only
// fetches a public, unauthenticated SPY benchmark series
// (/api/stock/history), so a signed-out visitor gets a genuinely live
// comparison line rendered against the fictional portfolio series, same as
// the actual production detail page and public share view both already do.
export default function PerformanceScene() {
  const isUp = DEMO_TOTAL_RETURN >= 0;

  return (
    <div className="flex flex-col gap-4 text-left">
      <section className="grid grid-cols-3 gap-3">
        <div className={cardClass("neutral", { extra: "flex flex-col gap-1 p-3" })}>
          <span className="text-xs text-foreground/50">Total Value</span>
          <p className="text-lg font-bold text-foreground">{compactCurrencyFormatter.format(DEMO_TOTAL_VALUE)}</p>
        </div>
        <div className={cardClass("neutral", { extra: "flex flex-col gap-1 p-3" })}>
          <span className="text-xs text-foreground/50">Total Return</span>
          <p className={`text-lg font-bold ${isUp ? "text-green-500" : "text-red-500"}`}>
            {isUp ? "+" : ""}
            {currencyFormatter.format(DEMO_TOTAL_RETURN)}
          </p>
          <span className={`text-[11px] ${isUp ? "text-green-500" : "text-red-500"}`}>
            {isUp ? "+" : ""}
            {DEMO_TOTAL_RETURN_PERCENT.toFixed(2)}%
          </span>
        </div>
        <div className={cardClass("neutral", { extra: "flex flex-col gap-1 p-3" })}>
          <span className="text-xs text-foreground/50">Created</span>
          <p className="text-lg font-bold text-foreground">
            {new Date(DEMO_CREATED_AT).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
          </p>
        </div>
      </section>

      <SimulatedPerformanceChart
        portfolio={{ createdAt: DEMO_CREATED_AT, startingBalance: 10000 }}
        performanceSeries={DEMO_PERFORMANCE_SERIES}
        totalValue={DEMO_TOTAL_VALUE}
      />

      <section className={cardClass("neutral", { extra: "flex flex-col gap-2 p-3" })}>
        <h2 className="text-sm font-semibold text-foreground">Holdings</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[500px] text-sm">
            <thead>
              <tr className="border-b border-black/10 text-xs text-foreground/50 dark:border-white/15">
                <th className="p-2 text-left">Symbol</th>
                <th className="p-2 text-right">Target Weight</th>
                <th className="p-2 text-right">Price at Creation</th>
                <th className="p-2 text-right">Current Price</th>
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
                  <td className="p-2 text-right text-foreground/70">{currencyFormatter.format(h.priceAtCreation)}</td>
                  <td className="p-2 text-right text-foreground">{currencyFormatter.format(h.currentPrice)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
