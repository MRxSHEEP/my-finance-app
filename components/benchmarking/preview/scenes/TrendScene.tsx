import { cardClass } from "@/lib/cardStyles";
import MiniLineChart from "@/components/MiniLineChart";
import { DEMO_REVENUE_GROWTH_TREND, DEMO_TICKERS } from "@/components/benchmarking/preview/sampleData";

// Mirrors BenchmarkDashboard.tsx's per-metric "Trend" section markup/classes
// exactly, featuring Revenue Growth — MiniLineChart is the real, unmodified
// component (pure/presentational, no fetch at all), fed a short fictional
// history that ends at each ticker's real current value (see sampleData.ts).
export default function TrendScene() {
  return (
    <section className={cardClass("neutral", { extra: "flex flex-col gap-3 p-4 text-left" })}>
      <h2 className="text-lg font-semibold text-foreground">Revenue Growth Trend</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {DEMO_TICKERS.map((t) => (
          <div key={t.ticker} className="flex flex-col gap-1">
            <span className={`text-xs font-medium ${t.isOwnCompany ? "text-indigo-400" : "text-foreground/70"}`}>
              {t.ticker}
              {t.isOwnCompany && " (Own)"}
            </span>
            <MiniLineChart data={DEMO_REVENUE_GROWTH_TREND[t.ticker]} height={48} />
          </div>
        ))}
      </div>
    </section>
  );
}
