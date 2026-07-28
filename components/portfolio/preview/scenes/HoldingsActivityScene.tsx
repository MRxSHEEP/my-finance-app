import { cardClass } from "@/lib/cardStyles";
import { DEMO_HOLDINGS_AFTER_TRADE, DEMO_RECENT_ACTIVITY } from "@/components/portfolio/preview/sampleData";

const currencyFormatter = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

// Mirrors SimulatedPortfolioDetailView.tsx's "Current Holdings" +
// "Recent Activity" table markup/classes exactly, fed the post-trade demo
// data (see sampleData.ts) — reflecting the NVDA buy just demonstrated in
// TradeScene, so this scene reads as "what you'd see right after."
export default function HoldingsActivityScene() {
  return (
    <div className="grid grid-cols-1 gap-4 text-left lg:grid-cols-2">
      <section className={cardClass("neutral", { extra: "flex flex-col gap-3 p-4" })}>
        <h2 className="text-lg font-semibold text-foreground">Current Holdings</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[500px] text-sm">
            <thead>
              <tr className="border-b border-black/10 text-xs text-foreground/50 dark:border-white/15">
                <th className="p-2 text-left">Symbol</th>
                <th className="p-2 text-right">Qty</th>
                <th className="p-2 text-right">Avg Cost</th>
                <th className="p-2 text-right">Price</th>
                <th className="p-2 text-right">Gain/Loss</th>
              </tr>
            </thead>
            <tbody>
              {DEMO_HOLDINGS_AFTER_TRADE.map((h) => {
                const gainLoss = (h.currentPrice - h.averageCostBasis) * h.quantity;
                const gainLossPercent = ((h.currentPrice - h.averageCostBasis) / h.averageCostBasis) * 100;
                return (
                  <tr key={h.symbol} className="border-t border-black/5 dark:border-white/10">
                    <td className="p-2 font-medium text-foreground">{h.symbol}</td>
                    <td className="p-2 text-right text-foreground/70">
                      {h.quantity.toLocaleString(undefined, { maximumFractionDigits: 6 })}
                    </td>
                    <td className="p-2 text-right text-foreground/70">{currencyFormatter.format(h.averageCostBasis)}</td>
                    <td className="p-2 text-right text-foreground">{currencyFormatter.format(h.currentPrice)}</td>
                    <td className={`p-2 text-right ${gainLoss === 0 ? "text-foreground/30" : gainLoss > 0 ? "text-green-500" : "text-red-500"}`}>
                      {gainLoss === 0 ? "—" : `${gainLoss >= 0 ? "+" : ""}${currencyFormatter.format(gainLoss)} (${gainLossPercent.toFixed(1)}%)`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className={cardClass("neutral", { extra: "flex flex-col gap-3 p-4" })}>
        <h2 className="text-lg font-semibold text-foreground">Recent Activity</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[400px] text-sm">
            <thead>
              <tr className="border-b border-black/10 text-xs text-foreground/50 dark:border-white/15">
                <th className="p-2 text-left">Symbol</th>
                <th className="p-2 text-left">Type</th>
                <th className="p-2 text-right">Price</th>
                <th className="p-2 text-right">Date</th>
              </tr>
            </thead>
            <tbody>
              {DEMO_RECENT_ACTIVITY.map((tx, i) => (
                <tr key={i} className="border-t border-black/5 dark:border-white/10">
                  <td className="p-2 font-medium text-foreground">{tx.symbol}</td>
                  <td className="p-2">
                    <span className="rounded-sm bg-green-400/10 px-1.5 py-0.5 text-xs font-medium text-green-500">Buy</span>
                  </td>
                  <td className="p-2 text-right text-foreground/70">{currencyFormatter.format(tx.price)}</td>
                  <td className="p-2 text-right text-xs text-foreground/40">
                    {new Date(tx.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
