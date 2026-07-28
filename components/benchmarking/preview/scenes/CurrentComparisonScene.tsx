import { cardClass } from "@/lib/cardStyles";
import BenchmarkBrandHeader from "@/components/benchmarking/BenchmarkBrandHeader";
import { DEMO_ORG_NAME, DEMO_TICKERS, type DemoTicker } from "@/components/benchmarking/preview/sampleData";

type MetricKey = keyof Omit<DemoTicker, "ticker" | "isOwnCompany">;

const METRIC_DEFS: Array<{ key: MetricKey; label: string; format: (v: number) => string; best: "min" | "max" }> = [
  { key: "revenueGrowth", label: "Revenue Growth", format: (v) => `${v.toFixed(1)}%`, best: "max" },
  { key: "grossMargin", label: "Gross Margin", format: (v) => `${v.toFixed(1)}%`, best: "max" },
  { key: "fcfYield", label: "FCF Yield", format: (v) => `${v.toFixed(1)}%`, best: "max" },
  { key: "forwardPE", label: "Forward P/E", format: (v) => v.toFixed(2), best: "min" },
  { key: "evEbitda", label: "EV/EBITDA", format: (v) => v.toFixed(2), best: "min" },
  { key: "roe", label: "ROE", format: (v) => `${v.toFixed(1)}%`, best: "max" },
];

// Same computeBest() as BenchmarkDashboard.tsx — finds the best value per
// row so it can be highlighted, fed the real metric values from sampleData.ts.
function computeBest(key: MetricKey, best: "min" | "max"): number {
  const values = DEMO_TICKERS.map((t) => t[key]);
  return best === "max" ? Math.max(...values) : Math.min(...values);
}

// Mirrors BenchmarkDashboard.tsx's brand header + "Current Comparison"
// table markup/classes exactly — BenchmarkBrandHeader is the real,
// unmodified component (pure/static, no fetch), and every value in the
// table is the real lib/benchmarking/metrics.ts output verified during
// this session's ticker-validation fix, not invented.
export default function CurrentComparisonScene() {
  return (
    <div className="flex flex-col gap-4 text-left">
      <BenchmarkBrandHeader name={DEMO_ORG_NAME} logoUrl={null} brandColor={null} />

      <section className={cardClass("neutral", { extra: "flex flex-col gap-3 p-4" })}>
        <h2 className="text-lg font-semibold text-foreground">Current Comparison</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[500px] text-sm">
            <thead>
              <tr className="border-b border-black/10 text-xs text-foreground/50 dark:border-white/15">
                <th className="p-2 text-left">Metric</th>
                {DEMO_TICKERS.map((t) => (
                  <th key={t.ticker} className={`p-2 text-right ${t.isOwnCompany ? "text-indigo-400" : ""}`}>
                    {t.ticker}
                    {t.isOwnCompany && <span className="ml-1 text-[10px] text-foreground/40">(Own)</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {METRIC_DEFS.map((def) => {
                const best = computeBest(def.key, def.best);
                return (
                  <tr key={def.key} className="border-t border-black/5 dark:border-white/10">
                    <td className="p-2 text-foreground/70">{def.label}</td>
                    {DEMO_TICKERS.map((t) => {
                      const value = t[def.key];
                      const isBest = value === best;
                      return (
                        <td
                          key={t.ticker}
                          className={`p-2 text-right ${
                            isBest ? "font-semibold text-green-500 drop-shadow-[0_0_6px_rgba(34,197,94,0.35)]" : "text-foreground"
                          }`}
                        >
                          {def.format(value)}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
