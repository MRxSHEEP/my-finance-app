import { cardClass } from "@/lib/cardStyles";
import SimulatedPerformanceChart from "@/components/portfolio/SimulatedPerformanceChart";
import {
  DEMO_CASH_BEFORE_TRADE,
  DEMO_CREATED_AT,
  DEMO_PERFORMANCE_SERIES,
  DEMO_TIER,
  DEMO_TOTAL_RETURN_BEFORE_TRADE,
  DEMO_TOTAL_RETURN_PERCENT_BEFORE_TRADE,
  DEMO_TOTAL_VALUE_BEFORE_TRADE,
} from "@/components/portfolio/preview/sampleData";

const currencyFormatter = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const compactCurrencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 2,
});

// Mirrors SimulatedPortfolioDetailView.tsx's stat-cards markup/classes
// exactly, fed fictional data — but SimulatedPerformanceChart itself is the
// REAL, unmodified component, not a recreation: its own benchmark fetch
// hits a public, unauthenticated endpoint (/api/stock/history?ticker=SPY),
// same reasoning already used to reuse it in the Model Portfolios walkthrough.
export default function PerformanceScene() {
  const isUp = DEMO_TOTAL_RETURN_BEFORE_TRADE >= 0;

  return (
    <div className="flex flex-col gap-4 text-left">
      <div className="flex items-center gap-2">
        <h1 className="text-lg font-bold text-foreground">{DEMO_TIER.label} Portfolio</h1>
      </div>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className={cardClass("neutral", { extra: "flex flex-col gap-1 p-3" })}>
          <span className="text-xs text-foreground/50">Total Value</span>
          <p className="text-lg font-bold text-foreground">{compactCurrencyFormatter.format(DEMO_TOTAL_VALUE_BEFORE_TRADE)}</p>
        </div>
        <div className={cardClass("neutral", { extra: "flex flex-col gap-1 p-3" })}>
          <span className="text-xs text-foreground/50">Total Return</span>
          <p className={`text-lg font-bold ${isUp ? "text-green-500" : "text-red-500"}`}>
            {isUp ? "+" : ""}
            {currencyFormatter.format(DEMO_TOTAL_RETURN_BEFORE_TRADE)}
          </p>
          <span className={`text-[11px] ${isUp ? "text-green-500" : "text-red-500"}`}>
            {isUp ? "+" : ""}
            {DEMO_TOTAL_RETURN_PERCENT_BEFORE_TRADE.toFixed(2)}%
          </span>
        </div>
        <div className={cardClass("neutral", { extra: "flex flex-col gap-1 p-3" })}>
          <span className="text-xs text-foreground/50">Cash Balance</span>
          <p className="text-lg font-bold text-foreground">{compactCurrencyFormatter.format(DEMO_CASH_BEFORE_TRADE)}</p>
        </div>
        <div className={cardClass("neutral", { extra: "flex flex-col gap-1 p-3" })}>
          <span className="text-xs text-foreground/50">Started</span>
          <p className="text-lg font-bold text-foreground">
            {new Date(DEMO_CREATED_AT).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
          </p>
        </div>
      </section>

      <SimulatedPerformanceChart
        portfolio={{ createdAt: DEMO_CREATED_AT, startingBalance: DEMO_TIER.startingBalance }}
        performanceSeries={DEMO_PERFORMANCE_SERIES}
        totalValue={DEMO_TOTAL_VALUE_BEFORE_TRADE}
      />
    </div>
  );
}
